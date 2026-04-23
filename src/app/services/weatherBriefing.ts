/**
 * 登录后的"天气 + 大棚"智能简报
 * - 拉取和风天气 3 天预报（重庆）
 * - 结合本地大棚作物清单，生成总结性播报 + 具体决策
 *
 * 规则概要（可按需扩展）：
 *  1. 阴天/雾/霾 → 补光（低光作物优先，时长加长）
 *  2. 雨天 → 暂停当日灌溉；小雨开内循环风机防霉；暴雨全封
 *  3. 晴天 + 高温(>30°) → 开风机降温；耐热弱作物(草莓/生菜)遮阳 + 加一次灌溉
 *  4. 晴天 + 温和(22–30°) → 常规灌溉；午间短暂通风
 *  5. 低温(<10°) → 停止灌溉，关闭通风以保温
 *  6. 明日有雨 → 今日提前给耐旱作物深灌一次
 *  7. 大风(>=5 级) → 关闭顶窗 / 外风口
 */

import type { GreenhouseItem } from "../lib/greenhouseStore";

const QWEATHER_HOST = "https://mf4t2cgffg.re.qweatherapi.com";
const QWEATHER_KEY = "1a7d555b3c8149558af49edb7e005083";
const CQ_LOCATION = "101040100"; // 重庆

export type QWeatherDaily = {
  fxDate: string;
  tempMax: string;
  tempMin: string;
  textDay: string;
  textNight: string;
  iconDay: string;
  windDirDay: string;
  windScaleDay: string;
};

export async function fetchChongqing3d(): Promise<QWeatherDaily[]> {
  // 用 7d 接口返回数组，和 Panel 共用同一个接口（账号该订阅已验证通过）
  const res = await fetch(
    `${QWEATHER_HOST}/v7/weather/7d?location=${CQ_LOCATION}`,
    { headers: { "X-QW-Api-Key": QWEATHER_KEY } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== "200") throw new Error(`code=${data.code}`);
  return data.daily as QWeatherDaily[];
}

// ── 作物画像（光/热/水需求） ─────────────────────────────────
type CropProfile = {
  /** 光需求：high=喜强光，low=耐阴 */
  light: "high" | "mid" | "low";
  /** 耐热：high=耐高温，low=怕热 */
  heat: "high" | "mid" | "low";
  /** 水需求：high=需勤灌，low=耐旱 */
  water: "high" | "mid" | "low";
};
const CROP_PROFILE: Record<string, CropProfile> = {
  番茄: { light: "high", heat: "high", water: "mid" },
  黄瓜: { light: "high", heat: "mid", water: "high" },
  辣椒: { light: "high", heat: "high", water: "mid" },
  茄子: { light: "high", heat: "high", water: "mid" },
  草莓: { light: "mid", heat: "low", water: "mid" },
  生菜: { light: "mid", heat: "low", water: "high" },
};
function profileOf(crop: string): CropProfile {
  return CROP_PROFILE[crop] ?? { light: "mid", heat: "mid", water: "mid" };
}

// ── 天气特征提取 ──────────────────────────────────────────
type DayFeature = {
  overcast: boolean;  // 阴/雾/霾
  rainy: boolean;     // 任意降水
  heavyRain: boolean; // 中到大雨及以上
  sunny: boolean;     // 晴
  hot: boolean;       // 最高温 > 30
  warm: boolean;      // 22–30
  cold: boolean;      // 最低温 < 10
  windy: boolean;     // 风力 >= 5
  tempMax: number;
  tempMin: number;
  textDay: string;
};
function featureOf(d: QWeatherDaily): DayFeature {
  const t = d.textDay ?? "";
  const max = Number(d.tempMax);
  const min = Number(d.tempMin);
  const scale = Number((d.windScaleDay ?? "0").split("-").pop());
  const rainy = /雨|阵雨/.test(t);
  const heavyRain = /中雨|大雨|暴雨|雷阵雨/.test(t);
  const overcast = /阴|雾|霾/.test(t);
  // 多云也视为晴天一类（有日照，只是不是全晴）
  const sunny = /晴|多云/.test(t);
  return {
    overcast,
    rainy,
    heavyRain,
    sunny,
    hot: max > 30,
    warm: max >= 22 && max <= 30,
    cold: min < 10,
    windy: Number.isFinite(scale) && scale >= 5,
    tempMax: max,
    tempMin: min,
    textDay: t,
  };
}

// ── 单个大棚的决策 ─────────────────────────────────────────
export type GhAction =
  | "补光"
  | "加强灌溉"
  | "常规灌溉"
  | "暂停灌溉"
  | "开风机通风"
  | "开内循环风机"
  | "关闭顶窗"
  | "遮阳"
  | "提前深灌"
  | "保温";

export type GhDecision = {
  name: string;
  crop: string;
  actions: GhAction[];
};

function decideForGreenhouse(
  gh: GreenhouseItem,
  today: DayFeature,
  tomorrow: DayFeature | null,
): GhAction[] {
  const p = profileOf(gh.crop);
  const actions = new Set<GhAction>();
  const crop = gh.crop;
  const isMultiCloud = /多云/.test(today.textDay);
  const isClear = /晴/.test(today.textDay) && !/多云/.test(today.textDay);

  // ── 光照管理 ─────────────────────────────────
  // 阴天/雾霾：所有作物都需要补光
  if (today.overcast) actions.add("补光");
  // 多云：喜强光作物（番茄/黄瓜/辣椒/茄子）需要补光
  if (isMultiCloud && p.light === "high") actions.add("补光");
  // 雨天：光照不足，全部补光
  if (today.rainy) actions.add("补光");
  // 低温短日照：日均温低时也倾向补光
  if (today.cold && !today.rainy) actions.add("补光");

  // ── 水分管理 ─────────────────────────────────
  if (today.rainy) {
    // 降水天停灌
    actions.add("暂停灌溉");
  } else if (today.cold) {
    // 低温停灌保温
    actions.add("暂停灌溉");
  } else if (today.hot) {
    // 高温：按耐热和需水强度分级
    if (p.heat === "low" || p.water === "high") {
      actions.add("加强灌溉");
    } else {
      actions.add("常规灌溉");
    }
  } else {
    // 温和日：至少常规灌溉
    actions.add("常规灌溉");
    // 叶菜/高水作物即使温和天也加量
    if (p.water === "high" && today.tempMax >= 25) {
      actions.add("加强灌溉");
    }
  }

  // 明日有雨 → 今日给耐旱作物提前深灌（锁水到明天）
  if (tomorrow?.rainy && !today.rainy && !today.cold && p.water !== "high") {
    actions.add("提前深灌");
  }

  // ── 通风与温度管理 ─────────────────────────────
  if (today.rainy && !today.heavyRain) {
    // 小雨：开内循环防闷热霉变
    actions.add("开内循环风机");
  }
  if (isClear && today.hot) {
    // 晴天高温必须通风
    actions.add("开风机通风");
  }
  if (isMultiCloud && today.tempMax >= 28) {
    // 多云闷热也开风机
    actions.add("开风机通风");
  }
  // 喜强光+耐热（番茄/辣椒/茄子）日间气温偏高→排湿防病害
  if (!today.rainy && today.tempMax >= 26 && p.heat === "high" && p.light === "high") {
    actions.add("开风机通风");
  }

  // ── 遮阳 ─────────────────────────────────────
  // 怕热作物（草莓/生菜）在高温或强日晒下遮阳
  if (p.heat === "low" && (today.hot || (isClear && today.tempMax >= 26))) {
    actions.add("遮阳");
  }

  // ── 保温 & 防风 ───────────────────────────────
  if (today.cold) {
    actions.add("保温");
  }
  // 大风日：关顶窗防倒灌
  if (today.windy || today.heavyRain) {
    actions.add("关闭顶窗");
  }

  // ── 特殊作物补丁：番茄/黄瓜常年高光高通风 ─────
  if ((crop === "番茄" || crop === "黄瓜") && isClear && !today.hot) {
    actions.add("开风机通风");
  }

  return Array.from(actions);
}

export function computeDecisions(
  greenhouses: GreenhouseItem[],
  daily: QWeatherDaily[],
): { todayText: string; decisions: GhDecision[] } {
  const today = featureOf(daily[0]);
  const tomorrow = daily[1] ? featureOf(daily[1]) : null;
  const decisions = greenhouses.map((gh) => ({
    name: gh.name,
    crop: gh.crop,
    actions: decideForGreenhouse(gh, today, tomorrow),
  }));
  const todayText = `今天重庆${today.textDay}，${today.tempMin}到${today.tempMax}度${today.windy ? "，风力较大" : ""}`;
  return { todayText, decisions };
}

/** 把决策映射到 UI 设备开关（LED/风机/灌溉） */
export function decisionsToSwitchMap(
  decisions: GhDecision[],
): Record<string, { led: boolean; motor: boolean; water: boolean }> {
  const out: Record<string, { led: boolean; motor: boolean; water: boolean }> = {};
  for (const d of decisions) {
    const acts = new Set(d.actions);
    const led = acts.has("补光");
    const motor = acts.has("开风机通风") || acts.has("开内循环风机");
    const water =
      (acts.has("常规灌溉") || acts.has("加强灌溉") || acts.has("提前深灌")) &&
      !acts.has("暂停灌溉");
    out[d.name] = { led, motor, water };
  }
  return out;
}

// ── 把决策按"动作 → 大棚列表"聚合并生成总结语 ────────────
export function buildBriefingText(
  greenhouses: GreenhouseItem[],
  daily: QWeatherDaily[],
): string {
  if (!greenhouses.length || !daily.length) return "";

  const { todayText, decisions } = computeDecisions(greenhouses, daily);

  // 反向聚合：动作 → 大棚名列表
  const byAction = new Map<GhAction, string[]>();
  for (const d of decisions) {
    for (const a of d.actions) {
      if (!byAction.has(a)) byAction.set(a, []);
      byAction.get(a)!.push(d.name);
    }
  }

  const actionOrder: GhAction[] = [
    "补光",
    "加强灌溉",
    "常规灌溉",
    "提前深灌",
    "暂停灌溉",
    "开风机通风",
    "开内循环风机",
    "遮阳",
    "关闭顶窗",
    "保温",
  ];

  const clauses: string[] = [];
  for (const a of actionOrder) {
    const list = byAction.get(a);
    if (!list || !list.length) continue;
    const who =
      list.length === greenhouses.length
        ? "全部大棚"
        : list.length >= 3
          ? `${list.slice(0, -1).join("、")}和${list[list.length - 1]}`
          : list.join("、");
    clauses.push(`已为${who}${a}`);
  }

  let core: string;
  if (!clauses.length) {
    core = "各大棚作物状态良好，无需特别干预，保持常规管理即可";
  } else {
    core = clauses.join("；");
  }

  const tomorrowHint =
    daily[1] && featureOf(daily[1]).rainy ? `明日${daily[1].textDay}，已为耐旱作物排上提前深灌。` : "";

  return `今天重庆${featureOf(daily[0]).textDay}，${featureOf(daily[0]).tempMin}到${featureOf(daily[0]).tempMax}度。基于当前天气和${greenhouses.length}个大棚的作物特征，${core}。${tomorrowHint}`.trim();
}
