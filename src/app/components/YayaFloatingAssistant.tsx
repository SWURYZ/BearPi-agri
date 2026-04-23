import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Send, Square, X } from "lucide-react";
import { startGestureRecognition, stopGestureRecognition, describeGestureError, type GestureLabel, type GestureEvent } from "../services/gestureRecognition";
import { sendManualControl, createScheduleRule, fetchScheduleRules, deleteScheduleRule } from "../services/deviceControl";
import { createCompositeRule } from "../services/compositeCondition";
import { createThresholdRule, runThresholdCheckNow } from "../services/thresholdAlert";
import { executeDecision, type SensorSnapshot } from "../services/smartDecision";
import { streamAgriAgentChat } from "../services/agriAgent";
import { fetchChongqing3d, buildBriefingText, computeDecisions, decisionsToSwitchMap } from "../services/weatherBriefing";
import { useGreenhouses, LOCKED_NAME } from "../lib/greenhouseStore";
import { setSwitches } from "../lib/virtualSwitchStore";

type Msg = { role: "user" | "assistant"; text: string };
type VoiceState = "idle" | "listening" | "thinking" | "speaking";
type GestureAnim = "none" | "summoning" | "dismissing" | "mic_opening" | "confirming" | "navigating";

type Point = { x: number; y: number };

const FAB_SIZE = 112;
const FAB_MARGIN = 20;
const PANEL_MIN_MARGIN = 12;
const PANEL_GAP = 16;

interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognitionResult {
  readonly [index: number]: ISpeechRecognitionAlternative;
  readonly length: number;
  readonly isFinal?: boolean;
}

interface ISpeechRecognitionResultList {
  readonly [index: number]: ISpeechRecognitionResult;
  readonly length: number;
}

interface ISpeechRecognitionEvent extends Event {
  readonly results: ISpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

const DEFAULT_DEVICE_ID = "69d75b1d7f2e6c302f654fea_20031104";

const GREENHOUSE_DEVICE_MAP: Record<string, string> = {
  "1": DEFAULT_DEVICE_ID,
  "2": DEFAULT_DEVICE_ID,
  "3": DEFAULT_DEVICE_ID,
  "4": DEFAULT_DEVICE_ID,
  "5": DEFAULT_DEVICE_ID,
  "6": DEFAULT_DEVICE_ID,
};

const KEYFRAMES = `
@keyframes yaya-float-mini {
  0%   { transform: translateY(0px)  rotate(-1deg) scale(1);    }
  50%  { transform: translateY(-8px) rotate(1deg)  scale(1.03); }
  100% { transform: translateY(0px)  rotate(-1deg) scale(1);    }
}
/* Rich idle "dance" — float + squash hop + curious look + tail wiggle, 7s loop */
@keyframes yaya-idle-dance {
  0%   { transform: translateY(0)    rotate(-1deg) scale(1, 1); }
  8%   { transform: translateY(-5px) rotate(-3deg) scale(1.02, 1.02); }
  16%  { transform: translateY(0)    rotate(0deg)  scale(1, 1); }
  24%  { transform: translateY(-5px) rotate(3deg)  scale(1.02, 1.02); }
  32%  { transform: translateY(0)    rotate(0deg)  scale(1, 1); }
  /* squash before hop */
  40%  { transform: translateY(3px)  rotate(0deg)  scale(1.10, 0.90); }
  /* stretch up */
  48%  { transform: translateY(-18px) rotate(-2deg) scale(0.92, 1.10); }
  /* squash on landing */
  54%  { transform: translateY(2px)  rotate(0deg)  scale(1.08, 0.94); }
  60%  { transform: translateY(0)    rotate(0deg)  scale(1, 1); }
  /* curious look L → R */
  70%  { transform: translateY(-4px) rotate(-7deg) scale(1.02, 1.02); }
  78%  { transform: translateY(-4px) rotate(7deg)  scale(1.02, 1.02); }
  /* tail wiggle */
  88%  { transform: translateY(-2px) rotate(-5deg) scale(1.02, 1.02); }
  94%  { transform: translateY(-2px) rotate(5deg)  scale(1.02, 1.02); }
  100% { transform: translateY(0)    rotate(-1deg) scale(1, 1); }
}
/* Breathing drop-shadow glow — for filter on the FAB button */
@keyframes yaya-breath-glow {
  0%,100% { filter: drop-shadow(0 6px 14px rgba(22,163,74,0.30)) drop-shadow(0 0 6px rgba(74,222,128,0.25)); }
  50%     { filter: drop-shadow(0 12px 24px rgba(22,163,74,0.55)) drop-shadow(0 0 18px rgba(74,222,128,0.55)); }
}
/* Orbiting sparkle around FAB — radius driven by translate */
@keyframes yaya-orbit {
  0%   { transform: rotate(0deg)   translateX(58px) rotate(0deg); }
  100% { transform: rotate(360deg) translateX(58px) rotate(-360deg); }
}
@keyframes yaya-orbit-rev {
  0%   { transform: rotate(0deg)    translateX(64px) rotate(0deg); }
  100% { transform: rotate(-360deg) translateX(64px) rotate(360deg); }
}
@keyframes yaya-twinkle {
  0%,100% { opacity: 0.3; transform: scale(0.6); }
  50%     { opacity: 1;   transform: scale(1.2); }
}
@keyframes yaya-glow {
  0%,100% { box-shadow: 0 10px 26px rgba(22,163,74,0.35), 0 0 0 0 rgba(74,222,128,0.2); }
  50%     { box-shadow: 0 20px 44px rgba(22,163,74,0.55), 0 0 0 14px rgba(74,222,128,0.06); }
}
@keyframes yaya-glow-speak {
  0%,100% { box-shadow: 0 8px 24px rgba(22,163,74,0.6), 0 0 0 0 rgba(74,222,128,0.45); }
  50%     { box-shadow: 0 14px 38px rgba(22,163,74,0.85), 0 0 0 20px rgba(74,222,128,0.04); }
}
@keyframes yaya-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes yaya-ripple {
  0%   { transform: scale(0.9); opacity: 0.55; }
  100% { transform: scale(2.5); opacity: 0;    }
}
@keyframes yaya-slide-up {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
@keyframes yaya-msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
@keyframes yaya-wave {
  0%,100% { transform: scaleY(0.25); }
  50%     { transform: scaleY(1.6);  }
}
@keyframes yaya-thinking-dot {
  0%,80%,100% { transform: scale(0.3); opacity: 0.3; }
  40%         { transform: scale(1);   opacity: 1;   }
}

/* ═══ Gesture Animations ════════════════════════════════════════════════ */

/* Summoning (thumbs_up) — elastic pop-in + rainbow glow */
@keyframes yaya-summon-pop {
  0%   { transform: scale(0.15) rotate(-25deg); opacity: 0; }
  50%  { transform: scale(1.22) rotate(8deg);   opacity: 1; }
  75%  { transform: scale(0.93) rotate(-4deg); }
  100% { transform: scale(1)    rotate(0deg);   }
}
@keyframes yaya-rainbow-glow {
  0%   { filter: drop-shadow(0 0 22px #4ade80) drop-shadow(0 0 8px #4ade80); }
  25%  { filter: drop-shadow(0 0 26px #facc15) drop-shadow(0 0 10px #f59e0b); }
  50%  { filter: drop-shadow(0 0 26px #f87171) drop-shadow(0 0 10px #ef4444); }
  75%  { filter: drop-shadow(0 0 26px #a78bfa) drop-shadow(0 0 10px #818cf8); }
  100% { filter: drop-shadow(0 0 22px #4ade80) drop-shadow(0 0 8px #4ade80); }
}
@keyframes yaya-summon-ring {
  0%   { transform: scale(0.9); opacity: 0.9; }
  100% { transform: scale(3.8); opacity: 0;   }
}
@keyframes yaya-spark-out {
  0%   { transform: rotate(var(--spark-angle)) translateX(0)   scale(1.2); opacity: 1; }
  100% { transform: rotate(var(--spark-angle)) translateX(72px) scale(0);   opacity: 0; }
}

/* Dismissing (thumbs_down) — wave + sink */
@keyframes yaya-bye-wave {
  0%,100% { transform: rotate(0deg)   scale(1);    }
  20%     { transform: rotate(-20deg) scale(1.05); }
  40%     { transform: rotate(14deg)  scale(1.02); }
  60%     { transform: rotate(-10deg) scale(0.97); }
  80%     { transform: rotate(6deg)   scale(0.92); }
}
@keyframes yaya-sink-away {
  0%   { transform: scale(1)    translateY(0);    opacity: 1;   }
  40%  { transform: scale(0.88) translateY(8px);  opacity: 0.75; }
  100% { transform: scale(0.4)  translateY(50px); opacity: 0;   }
}

/* Mic open (fist) — red radiate rings + body bounce */
@keyframes yaya-mic-radiate {
  0%   { transform: scale(1);   opacity: 0.85; }
  100% { transform: scale(3.0); opacity: 0;    }
}
@keyframes yaya-mic-bounce {
  0%,100% { transform: scale(1)    rotate(0deg); }
  30%     { transform: scale(1.16) rotate(-7deg); }
  65%     { transform: scale(1.08) rotate(5deg); }
}

/* OK confirm — spring pop + checkmark */
@keyframes yaya-ok-spring {
  0%   { transform: scale(1);    }
  28%  { transform: scale(1.32) rotate(12deg); }
  55%  { transform: scale(0.88) rotate(-5deg); }
  78%  { transform: scale(1.12); }
  100% { transform: scale(1)    rotate(0deg); }
}
@keyframes yaya-ok-check {
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  55%  { transform: scale(1.4) rotate(6deg);  opacity: 1; }
  80%  { transform: scale(0.95); }
  100% { transform: scale(1)    rotate(0deg); opacity: 0; }
}

/* Navigation jump (number gestures) */
@keyframes yaya-nav-leap {
  0%   { transform: translateY(0)    scale(1)    rotate(0deg); }
  30%  { transform: translateY(-30px) scale(1.14) rotate(12deg); }
  62%  { transform: translateY(-10px) scale(1.06) rotate(-5deg); }
  100% { transform: translateY(0)    scale(1)    rotate(0deg); }
}
@keyframes yaya-badge-pop {
  0%   { transform: scale(0)    rotate(-35deg); opacity: 0; }
  55%  { transform: scale(1.28) rotate(8deg);   opacity: 1; }
  80%  { transform: scale(0.95) rotate(-2deg); }
  100% { transform: scale(1)    rotate(0deg);   opacity: 1; }
}

/* Gesture feedback toast */
@keyframes yaya-gesture-toast {
  0%   { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.88); }
  18%  { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1.04); }
  22%  { transform: translateX(-50%) scale(1); }
  80%  { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.93); }
}
`;

const AGRI_KEYWORDS = [
  "灌溉", "施肥", "温度", "湿度", "光照", "光强", "补光", "病虫害", "病害", "虫害", "采收", "通风", "风机",
  "传感器", "温室", "大棚", "土壤", "水分", "营养", "肥料", "氮磷钾", "修剪", "种植", "播种", "发芽", "开花", "结果",
  "异常", "预警", "报警", "决策", "建议", "检测", "监控", "数据", "分析",
];

const GREETINGS: Record<string, string> = {
  "你好": "你好，我是芽芽，你的智慧农业小助手。",
  "早": "早上好，祝你今天大棚状态一路绿灯。",
  "晚上好": "晚上好，记得关注夜间温湿度变化。",
  "谢谢": "不客气，有事随时叫我。",
  "你是谁": "我是芽芽，擅长温室环境分析和控制指令执行。",
  "能干什么": "我可以帮你跳转页面、控制设备、创建规则、做农事决策建议。",
};

type DeviceCommand = {
  commandType: "LIGHT_CONTROL" | "MOTOR_CONTROL";
  action: "ON" | "OFF";
  label: string;
};

type NavCommand = {
  to: string;
  label: string;
};

const NAV_COMMANDS: Array<NavCommand & { aliases: string[] }> = [
  { to: "/", label: "总览大屏", aliases: ["总览大屏", "总览", "首页", "主页面", "主界面", "大屏"] },
  { to: "/monitor", label: "实时监测", aliases: ["实时监测", "实时监控", "实时数据", "监测页面"] },
  { to: "/alerts", label: "阈值告警", aliases: ["阈值告警", "告警页面", "报警页面", "预警页面"] },
  { to: "/control", label: "设备控制", aliases: ["设备控制", "控制页面", "控制中心", "手动控制"] },
  { to: "/automation", label: "联动规则", aliases: ["联动规则", "自动化", "规则页面", "联动页面"] },
  { to: "/history", label: "历史分析", aliases: ["历史分析", "历史数据", "趋势分析", "历史页面"] },
  { to: "/devices", label: "设备管理", aliases: ["设备管理", "设备页面", "设备列表"] },
  { to: "/ai", label: "农事问答", aliases: ["农事问答", "问答助手", "AI问答", "智能问答"] },
  { to: "/insect", label: "害虫识别", aliases: ["害虫识别", "虫害识别", "虫子识别", "拍虫", "识别虫害"] },
  { to: "/users", label: "用户管理", aliases: ["用户管理", "用户页面", "账号管理"] },
  { to: "/logs", label: "登录日志", aliases: ["登录日志", "日志页面", "用户日志"] },
];

const PHONETIC_FIXES: Array<[RegExp, string]> = [
  [/总览大平|总览大瓶|总览大坪/g, "总览大屏"],
  [/实时减测|实时监策|实时监侧/g, "实时监测"],
  [/法值告警|罚值告警|发值告警/g, "阈值告警"],
  [/连动规则|联动归则|联动鬼则/g, "联动规则"],
  [/设备空置|设备孔制|设备孔子/g, "设备控制"],
  [/补光登|补光等|不光灯/g, "补光灯"],
  [/风机电击|风机电级|风机电集/g, "风机电机"],
  [/二氧化探|二氧化탄|二氧化太/g, "二氧化碳"],
  [/湿杜|湿渡|适度/g, "湿度"],
  [/温渡|问度/g, "温度"],
  // ── 大棚：全局统一同音字纠正（所有下游解析都会受益） ──
  //   "大X" 里的 X 若是 棚 的常见同音/近音字一律视为「大棚」
  [/大(鹏|朋|蓬|篷|铺|彭|硼|捧|碰|棒|膨|盆|喷)/g, "大棚"],
  //   "搭X / 塔X" → "大棚"
  [/[搭塔哒](棚|鹏|朋|蓬|篷)/g, "大棚"],
  //   "N号大棚" 里的「号」常见误识为「好/豪/耗/嚎」
  [/(一|二|两|三|四|五|六|[1-6])(好|豪|耗|嚎)(大棚)/g, "$1号$3"],
  //   罕见情况："一号大鹏"在前一条已纠正，但若 ASR 直接吐出 "一浩大棚" / "1耗大棚" 也覆盖
  [/(一|二|两|三|四|五|六|[1-6])(浩|昊|郝|皓)大棚/g, "$1号大棚"],
  //   "聚角/聚脚/具焦" → "聚焦"
  [/聚(角|脚)|具焦/g, "聚焦"],
];

function normalizeSpeechText(text: string): string {
  let t = normalize(text);
  for (const [pattern, replacement] of PHONETIC_FIXES) {
    t = t.replace(pattern, replacement);
  }
  return t;
}

function scoreCommandCandidate(text: string): number {
  let score = 0;
  if (parseNavigationCommand(text)) score += 4;
  if (parseDeviceCommand(text)) score += 4;
  if (parseLightScheduleIntent(text)) score += 5;
  if (parseAutomationRuleIntent(text)) score += 5;
  if (parseThresholdIntent(text)) score += 5;
  if (quickReply(text)) score += 2;
  if (isAgriQuery(text)) score += 2;
  score += Math.min(2, text.length / 15);
  return score;
}

function pickBestAlternative(result: ISpeechRecognitionResult): { text: string; confidence: number } {
  let bestText = "";
  let bestScore = -1;
  let bestConfidence = 0;

  for (let i = 0; i < result.length; i += 1) {
    const alt = result[i];
    const normalized = normalizeSpeechText(alt?.transcript || "");
    if (!normalized) continue;

    const score = scoreCommandCandidate(normalized) + (alt?.confidence ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestText = normalized;
      bestConfidence = alt?.confidence ?? 0;
    }
  }

  return { text: bestText, confidence: bestConfidence };
}

function normalize(text: string) {
  return text.replace(/\s+/g, "").replace(/[，。！？,.!?:：；;、]/g, "");
}

function isAgriQuery(text: string): boolean {
  return AGRI_KEYWORDS.some((kw) => text.includes(kw));
}

function quickReply(text: string): string | null {
  for (const [kw, reply] of Object.entries(GREETINGS)) {
    if (text.includes(kw)) return reply;
  }
  return null;
}

function parseGreenhouseNo(text: string): string {
  const m = text.match(/([1-6])号大棚/);
  return m?.[1] || "1";
}

/**
 * 解析"聚焦于 N 号大棚 / 查看 N 号大棚 / 进入 N 号大棚"等指令
 * 返回 { ghNo: 1-6, label: "1号大棚" } 或 null
 * "返回全景 / 退出大棚 / 关闭大棚视图" → { back: true }
 *
 * 同音字容错：上游 normalizeSpeechText/PHONETIC_FIXES 已统一把「大鹏/大朋/大蓬…」、
 *            「一好大棚/1豪大棚」等纠正为标准写法，此处只做必要兜底。
 */
function parseGreenhouseFocusCommand(
  text: string,
): { ghNo: number; label: string } | { back: true } | null {
  let t = text.replace(/\s+/g, "");

  // 兜底：若本函数从未经 normalizeSpeechText 的路径调用，也能识别最常见误识
  t = t.replace(/大(鹏|朋|蓬|篷|铺|彭|硼|捧|碰|棒|膨|盆|喷)/g, "大棚");
  t = t.replace(/[搭塔哒](棚|鹏|朋|蓬|篷)/g, "大棚");

  // 返回全景指令（放在归一化之后）
  if (/(返回|退出|关闭|离开)(全景|大棚|大棚视图|大棚详情|聚焦)/.test(t)) {
    return { back: true };
  }
  if (/^(全景|总览|返回|退出)$/.test(t)) {
    return { back: true };
  }
  // 中文数字 → 阿拉伯数字（仅 1~6）
  const cn2num: Record<string, string> = { 一: "1", 二: "2", 两: "2", 三: "3", 四: "4", 五: "5", 六: "6" };
  const norm = t.replace(/(一|二|两|三|四|五|六)号大棚/g, (_, c) => `${cn2num[c]}号大棚`);
  // 必须出现 "N号大棚" 且包含聚焦/查看/进入/打开/看看 等动词
  const m = norm.match(/([1-6])号大棚/);
  if (!m) return null;
  const verbRe = /(聚焦|查看|看看|看一下|看一看|瞧瞧|瞅瞅|进入|打开|跳到|跳转到|切到|切换到|前往|去|到|展开|显示)/;
  if (!verbRe.test(norm)) return null;
  const ghNo = parseInt(m[1], 10);
  return { ghNo, label: `${ghNo}号大棚` };
}

function parseNavigationCommand(text: string): NavCommand | null {
  const t = text.replace(/\s+/g, "");
  const hasNavVerb = /(打开|进入|跳到|跳转到|切到|切换到|去|前往|到)/.test(t);

  for (const item of NAV_COMMANDS) {
    if (item.aliases.some((alias) => t.includes(alias))) {
      if (hasNavVerb || /页面|界面|大屏/.test(t) || t.length <= 10) {
        return { to: item.to, label: item.label };
      }
    }
  }
  return null;
}

/**
 * 中文时段表达式 → "HH:mm" "HH:mm"。识别：
 *   下午2点到4点 / 上午8点到10点 / 晚上7点到9点半 / 凌晨1点到3点
 *   14点到16点 / 14:00到16:00 / 2点30到4点
 * 不带时段词时，按 24 小时制原值（若 ≤12 视作上午）。
 */
function parseTimeRange(text: string): { turnOnTime: string; turnOffTime: string } | null {
  const t = text.replace(/\s+/g, "").replace(/[：]/g, ":");
  // 中文数字 → 阿拉伯数字（仅小时常见用法）
  const cn2num: Record<string, string> = { 零: "0", 一: "1", 二: "2", 两: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10", 十一: "11", 十二: "12" };
  const normalized = t.replace(/(十一|十二|十|零|一|二|两|三|四|五|六|七|八|九)/g, (m) => cn2num[m] ?? m);

  // 形如：(period)?(H)(:|点)(M)?(分)?(半)?到(period)?(H)(:|点)(M)?(分)?(半)?
  const re = /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|夜晚)?(\d{1,2})(?::|点)(\d{1,2})?(?:分)?(半)?(?:到|至|~|-|—)(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|夜晚)?(\d{1,2})(?::|点)?(\d{1,2})?(?:分)?(半)?/;
  const m = normalized.match(re);
  if (!m) return null;

  const toHour = (period: string | undefined, hStr: string): number => {
    let h = Math.min(23, Math.max(0, parseInt(hStr, 10)));
    if (period === "下午" || period === "傍晚" || period === "晚上" || period === "夜里" || period === "夜晚") {
      if (h < 12) h += 12;
    } else if (period === "中午") {
      if (h < 12) h += 12; // 中午1点 → 13
      if (h === 12) h = 12;
    } else if (period === "凌晨" || period === "早上" || period === "早晨" || period === "上午") {
      if (h === 12) h = 0; // 凌晨12点
    }
    return h;
  };
  const toMin = (mStr: string | undefined, halfFlag: string | undefined): number => {
    if (mStr) {
      const v = parseInt(mStr, 10);
      return isNaN(v) ? 0 : Math.min(59, Math.max(0, v));
    }
    if (halfFlag) return 30;
    return 0;
  };
  const fmt = (h: number, mi: number) => `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;

  const onH = toHour(m[1], m[2]);
  const onM = toMin(m[3], m[4]);
  // 第二段：若没显式 period，沿用第一段的 period（"下午2点到4点" → 第二段也用下午）
  const offPeriod = m[5] ?? m[1];
  const offH = toHour(offPeriod, m[6]);
  const offM = toMin(m[7], m[8]);

  const turnOnTime = fmt(onH, onM);
  const turnOffTime = fmt(offH, offM);
  if (turnOnTime >= turnOffTime) return null; // 跨天暂不支持
  return { turnOnTime, turnOffTime };
}

interface LightScheduleIntent {
  turnOnTime: string;
  turnOffTime: string;
  label: string;
  cancel?: boolean;
}

// 取消/关闭/删除 类动词
const LIGHT_SCHED_CANCEL_RE = /(取消|删除|移除|去掉|废除|关闭|关掉|关上|停止|停掉|不要(了)?|别要(了)?|别开)/;

function parseLightScheduleIntent(text: string): LightScheduleIntent | null {
  const t = text.replace(/\s+/g, "");
  // 必须同时包含「灯/补光灯」字样 + 时间段
  if (!/(补光灯|灯光|灯)/.test(t)) return null;
  // 必须有「到/至/-/~」连接的时间段，否则交给普通 parseDeviceCommand
  if (!/(到|至|~|-|—)/.test(t)) return null;
  const range = parseTimeRange(t);
  if (!range) return null;
  const cancel = LIGHT_SCHED_CANCEL_RE.test(t);
  return { turnOnTime: range.turnOnTime, turnOffTime: range.turnOffTime, label: "补光灯", cancel };
}

function parseDeviceCommand(text: string): DeviceCommand | null {
  const t = text.replace(/\s+/g, "");

  if (/(开|打开|开启|启动)(补光灯|灯|灯光)/.test(t)) {
    return { commandType: "LIGHT_CONTROL", action: "ON", label: "补光灯" };
  }
  if (/(关|关闭|关掉|熄灭)(补光灯|灯|灯光)/.test(t)) {
    return { commandType: "LIGHT_CONTROL", action: "OFF", label: "补光灯" };
  }
  if (/(开|打开|开启|启动)(风机|风扇|通风|电机|马达)/.test(t)) {
    return { commandType: "MOTOR_CONTROL", action: "ON", label: "风机/电机" };
  }
  if (/(关|关闭|关掉|停止)(风机|风扇|通风|电机|马达)/.test(t)) {
    return { commandType: "MOTOR_CONTROL", action: "OFF", label: "风机/电机" };
  }
  return null;
}

function parseAutomationRuleIntent(text: string) {
  const t = normalize(text);
  if (!/(新建|创建|添加).*(联动规则)|联动规则/.test(t)) {
    return null;
  }

  const gh = parseGreenhouseNo(t);
  const targetDeviceId = GREENHOUSE_DEVICE_MAP[gh] || DEFAULT_DEVICE_ID;

  const metric = t.includes("湿度")
    ? { sensorMetric: "Humidity", sensorLabel: "空气湿度", unit: "%" }
    : t.includes("光")
      ? { sensorMetric: "Luminance", sensorLabel: "光照强度", unit: "lux" }
      : t.includes("二氧化碳") || t.includes("co2")
        ? { sensorMetric: "co2", sensorLabel: "二氧化碳", unit: "ppm" }
        : { sensorMetric: "Temperature", sensorLabel: "空气温度", unit: "°C" };

  const operator = (/(小于|低于|<|不高于)/.test(t)
    ? "LT"
    : /(大于等于|不少于|>=)/.test(t)
      ? "GTE"
      : /(小于等于|不超过|<=)/.test(t)
        ? "LTE"
        : "GT") as "LT" | "GTE" | "LTE" | "GT";

  const number = t.match(/(-?\d+(?:\.\d+)?)/);
  const threshold = number ? Number(number[1]) : metric.sensorMetric === "Temperature" ? 30 : 500;

  const toLight = /(灯|补光)/.test(t);
  const commandType = toLight ? "LIGHT_CONTROL" : "MOTOR_CONTROL";
  const commandAction = /(关闭|关掉|停止|OFF|off)/.test(t) ? "OFF" : "ON";

  return {
    name: `语音联动-${Date.now().toString().slice(-6)}`,
    description: `语音创建：${gh}号大棚 ${metric.sensorLabel}`,
    logicOperator: "AND" as const,
    enabled: true,
    targetDeviceId,
    commandType,
    commandAction,
    conditions: [
      {
        sensorMetric: metric.sensorMetric,
        sourceDeviceId: targetDeviceId,
        operator,
        threshold,
      },
    ],
    summary: `${gh}号大棚：当${metric.sensorLabel}${operator === "LT" || operator === "LTE" ? "低于" : "高于"}${threshold}${metric.unit}时，${commandAction === "ON" ? "开启" : "关闭"}${toLight ? "补光灯" : "风机"}`,
  };
}

function parseThresholdIntent(text: string) {
  const t = normalize(text);
  if (!/(新建|创建|设置|添加).*(阈值|告警)|阈值告警/.test(t)) {
    return null;
  }

  const gh = parseGreenhouseNo(t);
  const metric = t.includes("湿度")
    ? "humidity"
    : t.includes("光")
      ? "light"
      : t.includes("二氧化碳") || t.includes("co2")
        ? "co2"
        : "temp";

  const suffix = metric === "humidity" ? "H01" : metric === "light" ? "L01" : metric === "co2" ? "C01" : "T01";
  const deviceId = `DEV-GH${gh.padStart(2, "0")}-${suffix}`;

  const range = t.match(/(-?\d+(?:\.\d+)?)到(-?\d+(?:\.\d+)?)/);
  const upperM = t.match(/(上限|最高|最大)[:：]?(\d+(?:\.\d+)?)/);
  const lowerM = t.match(/(下限|最低|最小)[:：]?(\d+(?:\.\d+)?)/);

  let min: number;
  let max: number;

  if (range) {
    min = Number(range[1]);
    max = Number(range[2]);
  } else {
    min = lowerM ? Number(lowerM[2]) : metric === "temp" ? 18 : metric === "humidity" ? 50 : metric === "light" ? 2000 : 350;
    max = upperM ? Number(upperM[2]) : metric === "temp" ? 30 : metric === "humidity" ? 80 : metric === "light" ? 10000 : 700;
  }

  if (max <= min) {
    max = min + 1;
  }

  return { deviceId, metric, min, max, gh };
}

/* ==================== LLM 意图理解（兜底智能化） ==================== */

type LlmIntent =
  | { action: "navigate"; to: string; label: string; reply: string }
  | {
      action: "device_control";
      commandType: "LIGHT_CONTROL" | "MOTOR_CONTROL";
      commandAction: "ON" | "OFF";
      greenhouseNo?: string;
      label: string;
      reply: string;
    }
  | { action: "light_schedule"; turnOnTime: string; turnOffTime: string; reply: string }
  | {
      action: "threshold_alert";
      greenhouseNo: string;
      metric: "temp" | "humidity" | "light" | "co2";
      min: number;
      max: number;
      reply: string;
    }
  | {
      action: "automation_rule";
      greenhouseNo: string;
      metric: "Temperature" | "Humidity" | "Luminance" | "co2";
      operator: "GT" | "LT" | "GTE" | "LTE";
      threshold: number;
      commandType: "LIGHT_CONTROL" | "MOTOR_CONTROL";
      commandAction: "ON" | "OFF";
      reply: string;
    }
  | { action: "answer"; reply: string }
  | { action: "unknown"; reply?: string };

const INTENT_SCHEMA_PROMPT = `你是芽芽智能农业助手的"指令路由器"。把用户语音指令解析成 **严格 JSON**，绝对不要输出 markdown 代码块、不要解释。
可选 action 与字段：
1. navigate —— 跳转页面：{ "action":"navigate", "to":"路径", "label":"中文名", "reply":"播报" }
   to 必须是：/ /monitor /alerts /control /automation /history /devices /ai /users /logs /insect
2. device_control —— 立即开关设备：{ "action":"device_control", "commandType":"LIGHT_CONTROL|MOTOR_CONTROL", "commandAction":"ON|OFF", "greenhouseNo":"1-6可选", "label":"补光灯|风机", "reply":"播报" }
3. light_schedule —— 创建补光灯定时规则：{ "action":"light_schedule", "turnOnTime":"HH:mm", "turnOffTime":"HH:mm", "reply":"播报" }（24 小时制）
4. threshold_alert —— 创建阈值告警：{ "action":"threshold_alert", "greenhouseNo":"1-6", "metric":"temp|humidity|light|co2", "min":数, "max":数, "reply":"播报" }
5. automation_rule —— 创建联动规则：{ "action":"automation_rule", "greenhouseNo":"1-6", "metric":"Temperature|Humidity|Luminance|co2", "operator":"GT|LT|GTE|LTE", "threshold":数, "commandType":"LIGHT_CONTROL|MOTOR_CONTROL", "commandAction":"ON|OFF", "reply":"播报" }
6. answer —— 用户在问问题/聊天而非下达指令：{ "action":"answer", "reply":"" }（reply 留空，让后续 Q&A 处理）
7. unknown —— 完全无法理解：{ "action":"unknown" }
reply 字段简短中文，≤30 字，是芽芽要语音回复用户的话。
用户输入：`;

function safeJsonExtract(raw: string): unknown | null {
  if (!raw) return null;
  // 去掉 markdown 围栏
  const cleaned = raw.replace(/```json\s*|```/gi, "").trim();
  // 取第一个 {…} 段
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function inferIntentWithLLM(userText: string): Promise<LlmIntent | null> {
  // 8 秒超时，避免阻塞用户
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  let acc = "";
  try {
    await streamAgriAgentChat(
      { question: `${INTENT_SCHEMA_PROMPT}"${userText}"` },
      {
        onToken: (t) => {
          acc += t;
        },
        onError: () => {
          /* swallow */
        },
      },
      ctrl.signal,
    );
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }

  const parsed = safeJsonExtract(acc);
  if (!parsed || typeof parsed !== "object" || !("action" in parsed)) return null;
  return parsed as LlmIntent;
}

function buildEnvAdvice(snapshot: SensorSnapshot): string[] {
  const advice: string[] = [];
  const temp = snapshot.temperature;
  const humidity = snapshot.humidity;
  const light = snapshot.luminance;

  if (typeof temp === "number") {
    if (temp >= 32) advice.push("温度偏高，建议优先通风降温并避免正午灌溉。");
    else if (temp <= 15) advice.push("温度偏低，建议夜间保温，减少大通风时长。");
  }

  if (typeof humidity === "number") {
    if (humidity >= 85) advice.push("湿度偏高，建议开启风机短时除湿，预防病害。");
    else if (humidity <= 45) advice.push("湿度偏低，建议小水量补灌并关注蒸腾过快问题。");
  }

  if (typeof light === "number" && light <= 250) {
    advice.push("当前光照偏弱，建议按作物生长期补光。");
  }

  return advice;
}

function mergeDecisionWithAdvice(decision: string, snapshot: SensorSnapshot): string {
  const advice = buildEnvAdvice(snapshot);
  if (advice.length === 0) return decision;
  return `${decision}\n\n【基于当前环境的补充建议】\n- ${advice.join("\n- ")}`;
}

function stripOptionalWakeWord(text: string): string {
  const trimmed = text.trim();
  return trimmed.replace(/^(芽芽|yaya)\s*[，,：:]?/i, "").trim();
}

type CanvasParticle = {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; alpha: number;
  colorHex: string; life: number;
};

function ParticleCanvas({ active, voiceState }: { active: boolean; voiceState: VoiceState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const pRef = useRef<CanvasParticle[]>([]);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 240; const H = 240;
    canvas.width = W; canvas.height = H;
    const cx = W / 2; const cy = H / 2;

    const COLORS = ["#4ade80", "#86efac", "#a7f3d0", "#6ee7b7", "#bbf7d0", "#d1fae5"];

    const tick = (ts: number) => {
      ctx.clearRect(0, 0, W, H);

      const rate =
        voiceState === "speaking" ? 38 :
          voiceState === "thinking" ? 55 :
            voiceState === "listening" ? 75 :
              active ? 140 : 1e9;

      if (active && ts - lastRef.current > rate) {
        lastRef.current = ts;
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 16;
        pRef.current.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.9,
          vy: -(0.5 + Math.random() * 2.0),
          radius: 1.5 + Math.random() * 2.5,
          alpha: 0.9,
          colorHex: COLORS[Math.floor(Math.random() * COLORS.length)],
          life: 1.0,
        });
      }

      const decay = voiceState === "speaking" ? 0.026 : voiceState === "thinking" ? 0.022 : 0.015;
      pRef.current = pRef.current.filter((p) => p.life > 0);

      for (const p of pRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.024;
        p.life -= decay;
        p.alpha = p.life * 0.9;
        const hex = Math.round(p.alpha * 255).toString(16).padStart(2, "0");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life + 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `${p.colorHex}${hex}`;
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, voiceState]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute"
      style={{ width: 240, height: 240, left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 0 }}
    />
  );
}

function YayaAvatar({ speaking }: { speaking: boolean }) {
  return (
    <svg viewBox="0 0 160 160" className="h-24 w-24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: speaking ? "drop-shadow(0 0 16px rgba(74,222,128,0.65))" : "drop-shadow(0 8px 20px rgba(22,163,74,0.45))" }}>
      <defs>
        <radialGradient id="fab-face" cx="38%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="fab-leaf" cx="28%" cy="20%" r="72%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#4ade80" />
        </radialGradient>
      </defs>
      <ellipse cx="57" cy="34" rx="22" ry="30" fill="url(#fab-leaf)" opacity="0.95" transform="rotate(-28 57 34)" />
      <ellipse cx="103" cy="32" rx="22" ry="30" fill="url(#fab-leaf)" opacity="0.85" transform="rotate(28 103 32)" />
      <rect x="77" y="42" width="6" height="20" rx="3" fill="#86efac" />
      <circle cx="80" cy="96" r="50" fill="url(#fab-face)" />
      <ellipse cx="62" cy="76" rx="16" ry="10" fill="rgba(255,255,255,0.14)" transform="rotate(-30 62 76)" />
      <ellipse cx="46" cy="104" rx="12" ry="7" fill="rgba(253,164,175,0.48)" />
      <ellipse cx="114" cy="104" rx="12" ry="7" fill="rgba(253,164,175,0.48)" />
      <ellipse cx="66" cy="86" rx="9" ry="10" fill="rgba(255,255,255,0.92)" />
      <ellipse cx="94" cy="86" rx="9" ry="10" fill="rgba(255,255,255,0.92)" />
      <circle cx="67" cy="88" r="5.2" fill="#15803d" />
      <circle cx="95" cy="88" r="5.2" fill="#15803d" />
      <circle cx="69.5" cy="85.5" r="2.2" fill="rgba(255,255,255,0.88)" />
      <circle cx="97.5" cy="85.5" r="2.2" fill="rgba(255,255,255,0.88)" />
      {speaking ? (
        <ellipse cx="80" cy="112" rx="9" ry="6" fill="rgba(255,255,255,0.9)" />
      ) : (
        <path d="M62 112 Q80 124 98 112" stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

export function YayaFloatingAssistant() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [alwaysListening, setAlwaysListening] = useState(false);
  const [input, setInput] = useState("");
  const [heardText, setHeardText] = useState("");
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  }));
  const [fabPos, setFabPos] = useState<Point>(() => ({
    x: (typeof window !== "undefined" ? window.innerWidth : 1280) - FAB_SIZE - FAB_MARGIN,
    y: (typeof window !== "undefined" ? window.innerHeight : 720) - FAB_SIZE - FAB_MARGIN,
  }));
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "我是芽芽，我会持续听你说话。直接下达指令就行。" },
  ]);

  const recRef = useRef<ISpeechRecognition | null>(null);
  const fabRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const supportedRef = useRef(true);
  const busyRef = useRef(false);
  const shouldListenRef = useRef(false);
  const ignoreInputUntilRef = useRef(0);
  /** TTS 播报期间暂停识别的标志（强防自我回放）。true 时 onresult/onend 全忽略 */
  const pausedForTtsRef = useRef(false);
  /** 暂停识别的恢复定时器 */
  const ttsResumeTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const pendingPickRef = useRef<{ text: string; confidence: number }>({ text: "", confidence: 0 });
  /** startAlwaysListening 的 ref 镜像（用于在 speakText 内调用，避免循环依赖） */
  const startListeningFnRef = useRef<(() => void) | null>(null);
  const heardTextRef = useRef(""); // 镜像 heardText state，供手势 callback 读取最新值
  heardTextRef.current = heardText; // 每次渲染同步，保证 gesture callback 读到最新值
  const lastResultIndexRef = useRef<number>(-1);
  const deviceIdRef = useRef(DEFAULT_DEVICE_ID);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [panelSize, setPanelSize] = useState({ width: 360, height: 460 });

  // ── Gesture recognition state ──────────────────────────────────────────
  const [yayaGestureActive, setYayaGestureActive]   = useState(false);
  const [gestureAnim, setGestureAnim]               = useState<GestureAnim>("none");
  const [gestureFeedback, setGestureFeedback]       = useState<{ icon: string; text: string; color: string } | null>(null);
  const [gestureNavNum, setGestureNavNum]           = useState(0);
  const gestureCleanupRef                           = useRef<(() => void) | null>(null);
  const gestureAnimTimerRef                         = useRef<number | null>(null);
  // Ref mirrors — 让 stable callback 始终读到最新状态，而不重启识别引擎
  const yayaGestureActiveRef                        = useRef(false);
  const gestureHandlerRef                           = useRef<(e: GestureEvent) => void>(() => {});

  const speechSupported = useMemo(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  const clampFabPosition = useCallback((pos: Point, width: number, height: number): Point => {
    const minX = PANEL_MIN_MARGIN;
    const minY = PANEL_MIN_MARGIN;
    const maxX = Math.max(minX, width - FAB_SIZE - PANEL_MIN_MARGIN);
    const maxY = Math.max(minY, height - FAB_SIZE - PANEL_MIN_MARGIN);
    return {
      x: Math.min(Math.max(pos.x, minX), maxX),
      y: Math.min(Math.max(pos.y, minY), maxY),
    };
  }, []);

  const push = useCallback((role: Msg["role"], text: string) => {
    setMessages((prev) => [...prev.slice(-13), { role, text }]);
  }, []);

  const { list: greenhousesList } = useGreenhouses();
  const greenhousesListRef = useRef(greenhousesList);
  greenhousesListRef.current = greenhousesList;

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (drag?.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }, []);

  const onFabPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: fabPos.x,
      originY: fabPos.y,
      moved: false,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [fabPos.x, fabPos.y]);

  const onFabPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      drag.moved = true;
    }

    const next = clampFabPosition(
      { x: drag.originX + dx, y: drag.originY + dy },
      viewport.width,
      viewport.height,
    );
    setFabPos(next);
  }, [clampFabPosition, viewport.height, viewport.width]);

  const onFabPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endDrag();
  }, [endDrag]);

  const onFabPointerCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endDrag();
  }, [endDrag]);

  // ── 统一声音选择器：两处 TTS 共用，确保芽芽声音一致 ──────────────────────
  const pickYayaVoice = useCallback((voices: SpeechSynthesisVoice[]) => {
    const zh = voices.filter((v) => v.lang.startsWith("zh"));
    // 优先级：
    // 1. Microsoft 神经网络语音（Natural/Online）音质最好，接近真人
    // 2. Xiaoxiao（小萱）/ Xiaoyi（小伊）女声
    // 3. 非男声回退
    // 4. 任意中文语音
    return (
      zh.find((v) => /natural|online/i.test(v.name) && /xiaoxiao|xiaoyi|xiaomeng|xiaochen/i.test(v.name)) ??
      zh.find((v) => /natural|online/i.test(v.name) && !/yunxi|yunyang|yunfeng|yunhao/i.test(v.name)) ??
      zh.find((v) => /xiaoxiao|xiaoyi/i.test(v.name)) ??
      zh.find((v) => !/male|yunxi|yunyang|yunfeng|yunhao/i.test(v.name)) ??
      zh[0]
    );
  }, []);

  const speakText = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setVoiceState("idle");
      return;
    }

    synth.cancel();

    // 防自我回放：彻底暂停语音识别（abort 比 stop 更立即），不让麦克风听到 TTS
    pausedForTtsRef.current = true;
    if (ttsResumeTimerRef.current != null) {
      window.clearTimeout(ttsResumeTimerRef.current);
      ttsResumeTimerRef.current = null;
    }
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    pendingPickRef.current = { text: "", confidence: 0 };
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }

    // 长 ignore 窗口：兜底防止 abort 之后还有残留 onresult 触发
    ignoreInputUntilRef.current = Date.now() + 30_000;

    const spokenText = text.length > 180 ? `${text.slice(0, 176)}...` : text;
    const pickVoice = pickYayaVoice;

    /** TTS 真正结束（或失败）时的统一收尾：恢复识别 */
    const finishTts = () => {
      pendingPickRef.current = { text: "", confidence: 0 };
      // 短暂 ignore：再过 600ms 才允许 dispatch，避免余音/回声被识别
      ignoreInputUntilRef.current = Date.now() + 600;
      if (ttsResumeTimerRef.current != null) {
        window.clearTimeout(ttsResumeTimerRef.current);
      }
      ttsResumeTimerRef.current = window.setTimeout(() => {
        ttsResumeTimerRef.current = null;
        pausedForTtsRef.current = false;
        // 恢复 listening 状态
        if (shouldListenRef.current) {
          // 通过 ref 调用 startAlwaysListening，避免依赖循环
          startListeningFnRef.current?.();
        } else {
          setVoiceState("idle");
        }
      }, 600);
    };

    const doSpeak = (voice?: SpeechSynthesisVoice) => {
      const utt = new SpeechSynthesisUtterance(spokenText);
      utt.lang = "zh-CN";
      utt.rate = 1.0;
      utt.pitch = 1.0;
      utt.volume = 1;
      if (voice) utt.voice = voice;
      utt.onend = finishTts;
      utt.onerror = finishTts;
      setVoiceState("speaking");
      synth.speak(utt);
    };

    const voices = synth.getVoices();
    if (voices.length > 0) {
      doSpeak(pickVoice(voices));
    } else {
      synth.onvoiceschanged = () => {
        doSpeak(pickVoice(synth.getVoices()));
        synth.onvoiceschanged = null;
      };
      setTimeout(() => {
        if (!synth.speaking) doSpeak();
      }, 300);
    }
  }, [pickYayaVoice]);

  // 登录/刷新后自动天气+大棚简报
  // StrictMode 下 useEffect 双调用：用 ref + 5 秒去重避免重播；
  // 不用长冷却，每次刷新都会播
  const briefedRef = useRef(false);
  useEffect(() => {
    if (briefedRef.current) return;
    const GUARD_KEY = "bearpi-agri:yaya-briefed-at";
    const lastAt = Number(sessionStorage.getItem(GUARD_KEY) ?? "0");
    if (lastAt && Date.now() - lastAt < 5_000) {
      console.info("[yaya] briefing skipped: recent (StrictMode)");
      return;
    }
    briefedRef.current = true;
    const timer = window.setTimeout(async () => {
      console.info("[yaya] briefing start…");
      try {
        const ghs = greenhousesListRef.current;
        console.info("[yaya] greenhouses:", ghs.length);
        if (!ghs.length) return;
        const daily = await fetchChongqing3d();
        console.info("[yaya] weather fetched, days:", daily.length);
        const briefing = buildBriefingText(ghs, daily);
        if (!briefing) return;

        // 真正执行决策：把 LED/风机/灌溉状态写入共享 store，RealtimeMonitor 即时可见
        const { decisions } = computeDecisions(ghs, daily);
        const switchMap = decisionsToSwitchMap(decisions);
        setSwitches(switchMap);

        // 1 号大棚是真实硬件：也把 LED/风机命令发给后端（灌溉是虚拟）
        const real = switchMap[LOCKED_NAME];
        if (real) {
          const DEVICE_ID = "69d75b1d7f2e6c302f654fea_20031104";
          Promise.allSettled([
            sendManualControl({ deviceId: DEVICE_ID, commandType: "LED", action: real.led ? "ON" : "OFF" }),
            sendManualControl({ deviceId: DEVICE_ID, commandType: "MOTOR", action: real.motor ? "ON" : "OFF" }),
          ]).catch(() => { /* ignore */ });
        }

        sessionStorage.setItem(GUARD_KEY, String(Date.now()));
        push("assistant", briefing);
        console.info("[yaya] briefing:", briefing);
        // 浏览器自动播放策略可能要求用户手势；若直接播无声，则在首次交互时补播
        try {
          speakText(briefing);
        } catch { /* ignore */ }
        // 500ms 后检查 speaking 是否启动；没启动则挂一次性手势监听
        window.setTimeout(() => {
          const synth = window.speechSynthesis;
          if (synth && !synth.speaking && !synth.pending) {
            console.info("[yaya] autoplay blocked, waiting for user gesture to speak");
            const replay = () => {
              window.removeEventListener("pointerdown", replay);
              window.removeEventListener("keydown", replay);
              speakText(briefing);
            };
            window.addEventListener("pointerdown", replay, { once: true });
            window.addEventListener("keydown", replay, { once: true });
          }
        }, 500);
      } catch (err) {
        // 天气接口挂掉就静默跳过，不影响主流程
        console.warn("[yaya] briefing skipped:", err);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
    // 只在挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeUnified = useCallback(async (rawText: string) => {
    const text = normalizeSpeechText(stripOptionalWakeWord(rawText)).trim();
    if (!text) return;

    push("user", text);
    setVoiceState("thinking");

    const nav = parseNavigationCommand(text);
    if (nav) {
      navigate(nav.to);
      const reply = `好的，已为你打开${nav.label}页面。`;
      push("assistant", reply);
      speakText(reply);
      return;
    }

    // 「聚焦/查看 N 号大棚」→ 切到实时监测页并打开对应大棚详情
    const ghFocus = parseGreenhouseFocusCommand(text);
    if (ghFocus) {
      // 先确保切到实时监测页
      navigate("/monitor");
      // 等待页面挂载后再分发事件
      setTimeout(() => {
        if ("back" in ghFocus) {
          window.dispatchEvent(new CustomEvent("yaya:focus-greenhouse-back"));
          const reply = "好的，已返回大棚全景视图。";
          push("assistant", reply);
          speakText(reply);
        } else {
          window.dispatchEvent(new CustomEvent("yaya:focus-greenhouse", {
            detail: { greenhouse: ghFocus.label },
          }));
          const reply = `好的，已为你聚焦到${ghFocus.label}。`;
          push("assistant", reply);
          speakText(reply);
        }
      }, 100);
      return;
    }

    // 优先匹配「定时灯控」：开启 下午2点到4点 的补光灯
    const lightSchedule = parseLightScheduleIntent(text);
    if (lightSchedule) {
      try {
        // 取消分支：先查后删
        if (lightSchedule.cancel) {
          const all = await fetchScheduleRules();
          const target = all.find(
            (r) =>
              r.deviceId === deviceIdRef.current &&
              r.turnOnTime.slice(0, 5) === lightSchedule.turnOnTime &&
              r.turnOffTime.slice(0, 5) === lightSchedule.turnOffTime &&
              (!r.commandType || r.commandType === "LIGHT_CONTROL"),
          );
          if (!target) {
            const fallback = all.find(
              (r) => r.deviceId === deviceIdRef.current && (r.commandType ?? "LIGHT_CONTROL") === "LIGHT_CONTROL",
            );
            if (!fallback) {
              const reply = `未找到 ${lightSchedule.turnOnTime}~${lightSchedule.turnOffTime} 的补光灯定时规则，无需取消。`;
              push("assistant", reply);
              speakText(reply);
              return;
            }
            await deleteScheduleRule(fallback.id);
            navigate("/control");
            const reply = `好的，已取消补光灯定时规则（${fallback.turnOnTime.slice(0, 5)}~${fallback.turnOffTime.slice(0, 5)}）。`;
            push("assistant", reply);
            speakText(reply);
            return;
          }
          await deleteScheduleRule(target.id);
          navigate("/control");
          const reply = `好的，已取消 ${lightSchedule.turnOnTime}~${lightSchedule.turnOffTime} 的补光灯定时规则。`;
          push("assistant", reply);
          speakText(reply);
          return;
        }
        const ruleName = `语音创建 ${lightSchedule.turnOnTime}-${lightSchedule.turnOffTime}`;
        await createScheduleRule({
          deviceId: deviceIdRef.current,
          ruleName,
          turnOnTime: lightSchedule.turnOnTime,
          turnOffTime: lightSchedule.turnOffTime,
          repeatMode: "DAILY",
          commandType: "LIGHT_CONTROL",
          enabled: true,
        });
        navigate("/control");
        const reply = `好的，已设置${lightSchedule.label}每天 ${lightSchedule.turnOnTime} 自动开启，${lightSchedule.turnOffTime} 自动关闭。`;
        push("assistant", reply);
        speakText(reply);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        const reply = `${lightSchedule.label}定时规则创建失败：${msg}`;
        push("assistant", reply);
        speakText(reply);
      }
      return;
    }

    const dev = parseDeviceCommand(text);
    if (dev) {
      try {
        const result = await sendManualControl({
          deviceId: deviceIdRef.current,
          commandType: dev.commandType,
          action: dev.action,
        });
        const actionText = dev.action === "ON" ? "开启" : "关闭";
        const reply = `${dev.label}${actionText}指令已发送。状态：${result.status}。`;
        push("assistant", reply);
        speakText(reply);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        const reply = `抱歉，${dev.label}控制失败：${msg}`;
        push("assistant", reply);
        speakText(reply);
      }
      return;
    }

    const automation = parseAutomationRuleIntent(text);
    if (automation) {
      try {
        await createCompositeRule({
          name: automation.name,
          description: automation.description,
          logicOperator: automation.logicOperator,
          enabled: automation.enabled,
          targetDeviceId: automation.targetDeviceId,
          commandType: automation.commandType,
          commandAction: automation.commandAction,
          conditions: automation.conditions,
        });
        navigate("/automation");
        const reply = `联动规则已创建：${automation.summary}`;
        push("assistant", reply);
        speakText(reply);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        const reply = `联动规则创建失败：${msg}`;
        push("assistant", reply);
        speakText(reply);
      }
      return;
    }

    const threshold = parseThresholdIntent(text);
    if (threshold) {
      try {
        await createThresholdRule({
          deviceId: threshold.deviceId,
          metric: threshold.metric,
          operator: "BELOW",
          threshold: threshold.min,
          enabled: true,
        });
        await createThresholdRule({
          deviceId: threshold.deviceId,
          metric: threshold.metric,
          operator: "ABOVE",
          threshold: threshold.max,
          enabled: true,
        });
        await runThresholdCheckNow();
        navigate("/alerts");
        const reply = `${threshold.gh}号大棚阈值告警已创建，区间 ${threshold.min} 到 ${threshold.max}。`;
        push("assistant", reply);
        speakText(reply);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        const reply = `阈值规则创建失败：${msg}`;
        push("assistant", reply);
        speakText(reply);
      }
      return;
    }

    const quick = quickReply(text);
    if (quick) {
      push("assistant", quick);
      speakText(quick);
      return;
    }

    // ── 规则全没命中 → 让大模型理解意图（智能化兜底） ──────────────────────
    setVoiceState("thinking");
    const intent = await inferIntentWithLLM(text);
    if (intent) {
      try {
        if (intent.action === "navigate") {
          // 校验 to 是合法路由
          const valid = NAV_COMMANDS.some((n) => n.to === intent.to);
          if (valid) {
            navigate(intent.to);
            const reply = intent.reply || `已为你打开${intent.label}页面。`;
            push("assistant", reply);
            speakText(reply);
            return;
          }
        } else if (intent.action === "device_control") {
          const targetDeviceId = intent.greenhouseNo
            ? GREENHOUSE_DEVICE_MAP[intent.greenhouseNo] || deviceIdRef.current
            : deviceIdRef.current;
          const result = await sendManualControl({
            deviceId: targetDeviceId,
            commandType: intent.commandType,
            action: intent.commandAction,
          });
          const reply = intent.reply || `${intent.label}指令已发送。状态：${result.status}。`;
          push("assistant", reply);
          speakText(reply);
          return;
        } else if (intent.action === "light_schedule") {
          await createScheduleRule({
            deviceId: deviceIdRef.current,
            ruleName: `语音创建 ${intent.turnOnTime}-${intent.turnOffTime}`,
            turnOnTime: intent.turnOnTime,
            turnOffTime: intent.turnOffTime,
            repeatMode: "DAILY",
            commandType: "LIGHT_CONTROL",
            enabled: true,
          });
          navigate("/control");
          const reply = intent.reply || `已设置补光灯每天 ${intent.turnOnTime} 自动开启，${intent.turnOffTime} 自动关闭。`;
          push("assistant", reply);
          speakText(reply);
          return;
        } else if (intent.action === "threshold_alert") {
          const suffix = intent.metric === "humidity" ? "H01" : intent.metric === "light" ? "L01" : intent.metric === "co2" ? "C01" : "T01";
          const alertDeviceId = `DEV-GH${intent.greenhouseNo.padStart(2, "0")}-${suffix}`;
          await createThresholdRule({
            deviceId: alertDeviceId,
            metric: intent.metric,
            operator: "BELOW",
            threshold: intent.min,
            enabled: true,
          });
          await createThresholdRule({
            deviceId: alertDeviceId,
            metric: intent.metric,
            operator: "ABOVE",
            threshold: intent.max,
            enabled: true,
          });
          await runThresholdCheckNow();
          navigate("/alerts");
          const reply = intent.reply || `${intent.greenhouseNo}号大棚阈值告警已创建。`;
          push("assistant", reply);
          speakText(reply);
          return;
        } else if (intent.action === "automation_rule") {
          const targetDeviceId = GREENHOUSE_DEVICE_MAP[intent.greenhouseNo] || deviceIdRef.current;
          await createCompositeRule({
            name: `语音联动-${Date.now().toString().slice(-6)}`,
            description: `语音创建：${intent.greenhouseNo}号大棚 ${intent.metric}`,
            logicOperator: "AND",
            enabled: true,
            targetDeviceId,
            commandType: intent.commandType,
            commandAction: intent.commandAction,
            conditions: [
              {
                sensorMetric: intent.metric,
                sourceDeviceId: targetDeviceId,
                operator: intent.operator,
                threshold: intent.threshold,
              },
            ],
          });
          navigate("/automation");
          const reply = intent.reply || "联动规则已创建。";
          push("assistant", reply);
          speakText(reply);
          return;
        }
        // intent.action === "answer" 或 "unknown" → 落到下面的 Q&A
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        const reply = `操作失败：${msg}`;
        push("assistant", reply);
        speakText(reply);
        return;
      }
    }

    if (!isAgriQuery(text)) {
      let accumulated = "";
      try {
        await streamAgriAgentChat(
          { question: text },
          {
            onToken: (token) => {
              accumulated += token;
            },
            onDone: () => { },
            onError: (msg) => {
              throw new Error(msg || "智能问答失败");
            },
          },
        );
        const reply = accumulated.trim() || "我暂时还不太懂这个问题，但有农事问题尽管问我。";
        push("assistant", reply);
        speakText(reply);
      } catch {
        const fallback = "我暂时还不太懂这个问题，但灌溉、施肥、光照这类农事问题我更擅长。";
        push("assistant", fallback);
        speakText(fallback);
      }
      return;
    }

    try {
      const res = await executeDecision({ query: text, deviceId: deviceIdRef.current });
      const enhanced = mergeDecisionWithAdvice(res.decision, res.sensorSnapshot);
      push("assistant", enhanced);
      speakText(enhanced);
    } catch {
      const errMsg = "抱歉，我遇到了一些问题，请稍后再试一次。";
      push("assistant", errMsg);
      speakText(errMsg);
    }
  }, [navigate, push, speakText]);

  const handleContinuousTranscript = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) {
      return;
    }
    if (Date.now() < ignoreInputUntilRef.current) {
      return;
    }

    busyRef.current = true;
    try {
      await executeUnified(text);
      setOpen(true);
    } finally {
      busyRef.current = false;
    }
  }, [executeUnified]);

  const stopAlwaysListening = useCallback(() => {
    shouldListenRef.current = false;
    setAlwaysListening(false);
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (ttsResumeTimerRef.current != null) {
      window.clearTimeout(ttsResumeTimerRef.current);
      ttsResumeTimerRef.current = null;
    }
    pendingPickRef.current = { text: "", confidence: 0 };
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  const startAlwaysListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      supportedRef.current = false;
      push("assistant", "当前浏览器不支持语音识别。建议使用 Chrome。");
      return;
    }

    shouldListenRef.current = true;

    const rec = new SR();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    recRef.current = rec;

    rec.onresult = (e) => {
      // 防自我回放：TTS 期间所有识别结果直接丢弃
      if (pausedForTtsRef.current) {
        return;
      }
      // Use resultIndex to always work on the current utterance, not accumulated history
      const resultIndex = e.resultIndex ?? (e.results.length - 1);
      const result = e.results[resultIndex];

      // New utterance started — hard-reset pending state so previous sentence never bleeds in
      if (resultIndex > lastResultIndexRef.current) {
        lastResultIndexRef.current = resultIndex;
        pendingPickRef.current = { text: "", confidence: 0 };
        if (silenceTimerRef.current != null) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      const picked = result ? pickBestAlternative(result) : { text: "", confidence: 0 };
      const isFinal = Boolean(result?.isFinal);

      if (picked.text) {
        setHeardText(picked.text);
        pendingPickRef.current = picked;
      }

      // Reset silence timer — user is still talking
      if (silenceTimerRef.current != null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const dispatch = () => {
        // 再次防护：dispatch 前检查 TTS 状态
        if (pausedForTtsRef.current) {
          pendingPickRef.current = { text: "", confidence: 0 };
          return;
        }
        const { text, confidence } = pendingPickRef.current;
        if (!text) return;
        pendingPickRef.current = { text: "", confidence: 0 };
        if (Date.now() < ignoreInputUntilRef.current) return;
        // confidence 过滤：很多浏览器返回 0，我们只在「极短文本」才用低置信度提醒
        // - 文本 ≥ 4 字直接信任（一般已经能表达完整意图）
        // - 文本 ≤ 3 字且无明确指令关键词 + 浏览器明确给出低置信度才提醒
        const weakCommand = scoreCommandCandidate(text) < 3;
        const tooShort = text.length <= 3;
        const browserGaveLowConf = confidence > 0 && confidence < 0.35;
        if (tooShort && weakCommand && browserGaveLowConf) {
          const reply = `我可能没听清，你刚才说的是"${text}"吗？请再说一次。`;
          push("assistant", reply);
          speakText(reply);
          return;
        }
        void handleContinuousTranscript(text).then(() => {
          // 每次自动发送后停止监听，用户可再用握拳手势继续发指令
          stopAlwaysListening();
        });
      };

      if (isFinal) {
        // Browser confirmed end — fire immediately, reset index tracking
        lastResultIndexRef.current = resultIndex;
        dispatch();
      } else {
        // Siri-style: 800 ms of silence = sentence end（更接近自然停顿，避免误切）
        silenceTimerRef.current = window.setTimeout(() => {
          silenceTimerRef.current = null;
          dispatch();
        }, 800);
      }
    };

    rec.onerror = () => {
      if (!shouldListenRef.current || pausedForTtsRef.current) {
        return;
      }
      setAlwaysListening(false);
      if (restartTimerRef.current != null) {
        window.clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = window.setTimeout(() => {
        if (!pausedForTtsRef.current) startAlwaysListening();
      }, 800);
    };

    rec.onend = () => {
      if (!shouldListenRef.current || pausedForTtsRef.current) {
        // TTS 暂停期间：让 finishTts 来负责重启
        return;
      }
      if (restartTimerRef.current != null) {
        window.clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = window.setTimeout(() => {
        if (!pausedForTtsRef.current) startAlwaysListening();
      }, 250);
    };

    setVoiceState("listening");
    try {
      rec.start();
      setAlwaysListening(true);
    } catch {
      setAlwaysListening(false);
      setVoiceState("idle");
      push("assistant", "麦克风权限未就绪，请点击芽芽头像授权一次。授权后会持续监听。");
    }
  }, [handleContinuousTranscript, push, speakText, stopAlwaysListening]);

  // 把最新的 startAlwaysListening 写入 ref，供 speakText 内回调使用（避免循环依赖）
  startListeningFnRef.current = startAlwaysListening;

  // ── 全局桥：其它组件可通过 window.dispatchEvent(new CustomEvent("yaya:speak", { detail: {...} })) 让芽芽开口
  useEffect(() => {
    const onSpeak = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; userText?: string; openPanel?: boolean }>).detail;
      if (!detail || !detail.text) return;
      if (detail.userText) push("user", detail.userText);
      push("assistant", detail.text);
      if (detail.openPanel) setOpen(true);
      // 标记芽芽为「已唤醒」状态，使 thumbs_down/fist/OK/数字 等手势能立即生效
      // 否则用户在芽芽自动播报病虫害时，必须先做 👍 才能再做 👎 关闭
      yayaGestureActiveRef.current = true;
      setYayaGestureActive(true);
      speakText(detail.text);
    };
    const onStop = () => {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      setVoiceState("idle");
    };
    window.addEventListener("yaya:speak", onSpeak as EventListener);
    window.addEventListener("yaya:stop", onStop);
    return () => {
      window.removeEventListener("yaya:speak", onSpeak as EventListener);
      window.removeEventListener("yaya:stop", onStop);
    };
  }, [push, speakText]);

  // ── Gesture recognition handler ────────────────────────────────────────────
  const triggerGestureAnim = useCallback((anim: GestureAnim, duration: number) => {
    if (gestureAnimTimerRef.current !== null) window.clearTimeout(gestureAnimTimerRef.current);
    setGestureAnim(anim);
    gestureAnimTimerRef.current = window.setTimeout(() => {
      setGestureAnim("none");
      gestureAnimTimerRef.current = null;
    }, duration);
  }, []);

  const NAV_ROUTES = ["/", "/monitor", "/alerts", "/control", "/automation", "/history", "/devices", "/ai"];
  const NAV_LABELS = ["总览大屏", "实时监测", "阈值告警", "设备控制", "联动规则", "历史分析", "设备管理", "农事问答"];
  const NUM_KEYS: GestureLabel[] = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
  const NUM_ICONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];

  // 手势语音播报（简短、人性化）
  const gestureSpeak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "zh-CN"; utt.rate = 1.0; utt.pitch = 1.0; utt.volume = 1;
    // 播放前锁定麦克风：预估时长 = max(3s, 每字 150ms) + 缓冲
    ignoreInputUntilRef.current = Date.now() + Math.max(3000, text.length * 150);
    utt.onend  = () => { ignoreInputUntilRef.current = Date.now() + 1200; };
    utt.onerror = () => { ignoreInputUntilRef.current = Date.now() + 500; };
    const vs = synth.getVoices();
    if (vs.length) { const v = pickYayaVoice(vs); if (v) utt.voice = v; synth.speak(utt); }
    else { synth.onvoiceschanged = () => { const v = pickYayaVoice(synth.getVoices()); if (v) utt.voice = v; synth.speak(utt); synth.onvoiceschanged = null; }; }
  }, [pickYayaVoice]);

  const handleGesture = useCallback((event: GestureEvent) => {
    const { gesture } = event;

    // 未唤醒时只响应 thumbs_up
    if (!yayaGestureActiveRef.current && gesture !== "thumbs_up") return;

    switch (gesture) {
      case "thumbs_up":
        yayaGestureActiveRef.current = true;
        setYayaGestureActive(true);
        setOpen(true);
        triggerGestureAnim("summoning", 1100);
        setGestureFeedback({ icon: "👍", text: "芽芽来啦！说话就行", color: "#4ade80" });
        gestureSpeak("嗨～我是芽芽，请说话");
        // 立即开启监听，状态栏同步更新；ignoreInputUntilRef 已锁住播报期间的语音输入
        if (speechSupported) startAlwaysListening();
        break;

      case "thumbs_down":
        yayaGestureActiveRef.current = false;
        setYayaGestureActive(false);
        setOpen(false);
        triggerGestureAnim("dismissing", 900);
        setGestureFeedback({ icon: "👋", text: "芽芽休息啦，随时唤醒我~", color: "#f87171" });
        gestureSpeak("好的，芽芽先休息了，拜拜～");
        stopAlwaysListening();
        break;

      case "fist":
        if (shouldListenRef.current) return; // 已在监听，忽略重复开启
        triggerGestureAnim("mic_opening", 700);
        setGestureFeedback({ icon: "✊", text: "继续听，请说话", color: "#ef4444" });
        gestureSpeak("继续听，请说话");
        window.setTimeout(() => { if (speechSupported) startAlwaysListening(); }, 1200);
        break;

      case "ok":
        triggerGestureAnim("confirming", 750);
        if (input.trim()) {
          // 有文字输入：发送文字框内容，停止监听
          setGestureFeedback({ icon: "👌", text: "发送中…", color: "#22c55e" });
          gestureSpeak("好的，已发送");
          stopAlwaysListening();
          void executeUnified(input).then(() => setInput(""));
        } else if (heardTextRef.current.trim()) {
          // 有语音识别内容：发送，停止监听
          const voiceText = heardTextRef.current.trim();
          setHeardText("");
          pendingPickRef.current = { text: "", confidence: 0 };
          stopAlwaysListening();
          setGestureFeedback({ icon: "👌", text: "发送语音指令…", color: "#22c55e" });
          gestureSpeak("好的，已发送语音指令");
          void executeUnified(voiceText).then(() => setOpen(true));
        } else {
          setGestureFeedback({ icon: "👌", text: "OK", color: "#22c55e" });
        }
        break;

      default: {
        const numIdx = NUM_KEYS.indexOf(gesture);
        if (numIdx >= 0) {
          setGestureNavNum(numIdx + 1);
          triggerGestureAnim("navigating", 750);
          setGestureFeedback({
            icon: NUM_ICONS[numIdx],
            text: `前往 ${NAV_LABELS[numIdx]}`,
            color: "#818cf8",
          });
          gestureSpeak(`好的，正在跳转到${NAV_LABELS[numIdx]}`);
          window.setTimeout(() => navigate(NAV_ROUTES[numIdx]), 900);
        }
        break;
      }
    }
  // 只依赖真正稳定的引用，不包含 state——state 通过 ref 读取
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerGestureAnim, gestureSpeak, stopAlwaysListening, startAlwaysListening, speechSupported, navigate, input, executeUnified, setInput, setHeardText]);

  // 每次渲染后更新 ref，不重启识别引擎
  gestureHandlerRef.current = handleGesture;

  // Stable wrapper — 身份永不改变，始终调用最新的 handleGesture
  const stableGestureCallback = useCallback((e: GestureEvent) => {
    gestureHandlerRef.current(e);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖 = 只创建一次

  // ── Gesture recognition lifecycle（启动一次，永不重启）─────────────────────
  useEffect(() => {
    let cancelled = false;
    startGestureRecognition(stableGestureCallback)
      .then((cleanup) => {
        if (cancelled) { cleanup(); return; }
        gestureCleanupRef.current = cleanup;
      })
      .catch((err: unknown) => {
        console.error("[GestureRec]", err);
        setGestureFeedback({ icon: "📷", text: describeGestureError(err), color: "#f87171" });
      });
    return () => {
      cancelled = true;
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
    };
  // stableGestureCallback 身份永不变，此 effect 只在 mount 时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-dismiss gesture feedback toast ────────────────────────────────────
  useEffect(() => {
    if (!gestureFeedback) return;
    const t = window.setTimeout(() => setGestureFeedback(null), 2200);
    return () => window.clearTimeout(t);
  }, [gestureFeedback]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      supportedRef.current = false;
    }
    // 不自动启动监听：需通过 thumbs_up 唤醒芽芽后，再用 fist 手势开启
    return () => {
      stopAlwaysListening();
      window.speechSynthesis?.cancel();
    };
  }, [stopAlwaysListening]);

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({ width, height });
      setFabPos((prev) => clampFabPosition(prev, width, height));
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [clampFabPosition]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const measure = () => {
      setPanelSize({
        width: panel.offsetWidth || 360,
        height: panel.offsetHeight || 460,
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, viewport.width, viewport.height, messages.length, heardText, voiceState]);

  useEffect(() => {
    if (!open) return;

    const onDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    };
  }, [open]);

  const maxLeft = Math.max(PANEL_MIN_MARGIN, viewport.width - PANEL_MIN_MARGIN - panelSize.width);
  const panelLeft = Math.min(
    Math.max(fabPos.x + FAB_SIZE - panelSize.width + 4, PANEL_MIN_MARGIN),
    maxLeft,
  );

  const belowTop = fabPos.y + FAB_SIZE + PANEL_GAP;
  const aboveTop = fabPos.y - panelSize.height - PANEL_GAP;
  const canPlaceBelow = belowTop + panelSize.height <= viewport.height - PANEL_MIN_MARGIN;
  const canPlaceAbove = aboveTop >= PANEL_MIN_MARGIN;
  const preferredTop = canPlaceBelow || !canPlaceAbove ? belowTop : aboveTop;
  const maxTop = Math.max(PANEL_MIN_MARGIN, viewport.height - PANEL_MIN_MARGIN - panelSize.height);
  const panelTop = Math.min(Math.max(preferredTop, PANEL_MIN_MARGIN), maxTop);

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Floating Yaya button with particle halo + ripple rings ── */}
      <div
        ref={fabRef}
        className="fixed z-[75]"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          left: fabPos.x,
          top: fabPos.y,
          userSelect: "none",
          touchAction: "none",
          overflow: "visible",
        }}
      >
        {/* Ripple rings while listening */}
        {alwaysListening && (voiceState === "listening" || voiceState === "speaking") && (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid rgba(74,222,128,0.45)",
                animation: "yaya-ripple 2.2s ease-out infinite",
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid rgba(74,222,128,0.25)",
                animation: "yaya-ripple 2.2s ease-out 0.75s infinite",
              }}
            />
          </>
        )}

        {/* Particle canvas */}
        <ParticleCanvas active={alwaysListening} voiceState={voiceState} />

        {/* Orbiting sparkles — only when idle and not in any gesture animation */}
        {voiceState === "idle" && gestureAnim === "none" && !dragging && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 0 }}
          >
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: 6,
                height: 6,
                marginLeft: -3,
                marginTop: -3,
                animation: "yaya-orbit 6s linear infinite",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, #fef08a 0%, #facc15 60%, transparent 100%)",
                  boxShadow: "0 0 10px #facc15, 0 0 4px #fff",
                  animation: "yaya-twinkle 1.4s ease-in-out infinite",
                }}
              />
            </div>
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: 5,
                height: 5,
                marginLeft: -2.5,
                marginTop: -2.5,
                animation: "yaya-orbit 8s linear infinite",
                animationDelay: "-2.6s",
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, #bbf7d0 0%, #4ade80 60%, transparent 100%)",
                  boxShadow: "0 0 10px #4ade80, 0 0 4px #fff",
                  animation: "yaya-twinkle 1.8s ease-in-out infinite",
                }}
              />
            </div>
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: 5,
                height: 5,
                marginLeft: -2.5,
                marginTop: -2.5,
                animation: "yaya-orbit-rev 10s linear infinite",
                animationDelay: "-1.3s",
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, #e9d5ff 0%, #a78bfa 60%, transparent 100%)",
                  boxShadow: "0 0 10px #a78bfa, 0 0 4px #fff",
                  animation: "yaya-twinkle 2.2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        )}

        {/* Avatar button – floating mascot, no container */}
        <button
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            setOpen((v) => !v);
          }}
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          onPointerCancel={onFabPointerCancel}
          className="relative z-[1] flex h-28 w-28 items-center justify-center"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            animation:
              gestureAnim === "summoning"
                ? "yaya-summon-pop 0.85s cubic-bezier(0.34,1.56,0.64,1) both"
                : gestureAnim === "dismissing"
                  ? "yaya-bye-wave 0.6s ease-in-out, yaya-sink-away 0.85s 0.1s ease-in forwards"
                  : gestureAnim === "mic_opening"
                    ? "yaya-mic-bounce 0.55s ease-in-out infinite"
                    : gestureAnim === "confirming"
                      ? "yaya-ok-spring 0.65s cubic-bezier(0.34,1.56,0.64,1)"
                      : gestureAnim === "navigating"
                        ? "yaya-nav-leap 0.75s cubic-bezier(0.34,1.56,0.64,1)"
                        : voiceState === "speaking"
                          ? "yaya-float-mini 0.5s ease-in-out infinite"
                          : "yaya-idle-dance 7s cubic-bezier(0.45,0.05,0.55,0.95) infinite, yaya-breath-glow 4.6s ease-in-out infinite",
          }}
          aria-label="打开芽芽助手"
        >
          <YayaAvatar speaking={voiceState === "speaking"} />

          {/* Ground shadow glow beneath feet */}
          <div
            style={{
              position: "absolute",
              bottom: 2,
              left: "50%",
              transform: "translateX(-50%)",
              width: 64,
              height: 16,
              borderRadius: "50%",
              background:
                voiceState === "speaking"
                  ? "radial-gradient(ellipse, rgba(239,68,68,0.5) 0%, transparent 70%)"
                  : "radial-gradient(ellipse, rgba(74,222,128,0.55) 0%, transparent 70%)",
              filter: "blur(7px)",
              pointerEvents: "none",
              transition: "background 0.5s ease",
            }}
          />

          {/* Status indicator dot */}
          <div
            style={{
              position: "absolute",
              bottom: 18,
              right: 8,
              width: 13,
              height: 13,
              borderRadius: "50%",
              background:
                voiceState === "speaking"
                  ? "#ef4444"
                  : voiceState === "thinking"
                    ? "#f59e0b"
                    : alwaysListening
                      ? "#22c55e"
                      : "#6b7280",
              border: "2.5px solid rgba(255,255,255,0.88)",
              boxShadow:
                voiceState === "speaking"
                  ? "0 0 8px rgba(239,68,68,0.85)"
                  : voiceState === "thinking"
                    ? "0 0 8px rgba(245,158,11,0.85)"
                    : alwaysListening
                      ? "0 0 8px rgba(34,197,94,0.9)"
                      : "none",
              transition: "all 0.3s ease",
            }}
          />
        </button>

        {/* ── Gesture: Summoning sparkles (thumbs_up) ── */}
        {gestureAnim === "summoning" && (
          <>
            {/* Rainbow expanding rings */}
            {[0, 0.22, 0.44].map((delay, i) => (
              <div key={i} style={{
                position: "absolute", inset: 14, borderRadius: "50%",
                border: `3px solid ${["rgba(74,222,128,0.85)","rgba(250,204,21,0.75)","rgba(167,139,250,0.70)"][i]}`,
                animation: `yaya-summon-ring 1.05s ease-out ${delay}s both`,
                pointerEvents: "none",
              }} />
            ))}
            {/* Sparkle particles */}
            {[0,45,90,135,180,225,270,315].map((deg, i) => (
              <div key={i} style={{
                position: "absolute", left: "50%", top: "50%",
                width: 11, height: 11, marginLeft: -5.5, marginTop: -5.5,
                borderRadius: "50%", pointerEvents: "none",
                background: ["#4ade80","#facc15","#f87171","#a78bfa","#22d3ee","#f97316","#a3e635","#fb7185"][i],
                ["--spark-angle" as string]: `${deg}deg`,
                animation: `yaya-spark-out 0.95s ease-out ${i * 0.05}s forwards`,
              } as React.CSSProperties} />
            ))}
          </>
        )}

        {/* ── Gesture: Mic radiate rings (fist) ── */}
        {gestureAnim === "mic_opening" && (
          <>
            {[0, 0.3, 0.6].map((delay, i) => (
              <div key={i} style={{
                position: "absolute", inset: 8, borderRadius: "50%",
                border: "2.5px solid rgba(239,68,68,0.75)",
                animation: `yaya-mic-radiate 1.1s ease-out ${delay}s infinite`,
                pointerEvents: "none",
              }} />
            ))}
          </>
        )}

        {/* ── Gesture: Navigation number badge (one-eight) ── */}
        {gestureAnim === "navigating" && gestureNavNum > 0 && (
          <div style={{
            position: "absolute", top: -10, right: -8, zIndex: 10,
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg,#818cf8,#6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#fff",
            animation: "yaya-badge-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both",
            boxShadow: "0 4px 18px rgba(99,102,241,0.7)",
            pointerEvents: "none",
          }}>
            {gestureNavNum}
          </div>
        )}

        {/* ── Gesture: OK confirm checkmark badge ── */}
        {gestureAnim === "confirming" && (
          <div style={{
            position: "absolute", top: -8, right: -4, zIndex: 10,
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#fff", fontWeight: 700,
            animation: "yaya-ok-check 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards",
            boxShadow: "0 4px 16px rgba(34,197,94,0.7)",
            pointerEvents: "none",
          }}>
            ✓
          </div>
        )}

        {/* ── Gesture feedback toast (rises above FAB) ── */}
        {gestureFeedback && (
          <div style={{
            position: "absolute",
            bottom: FAB_SIZE + 12,
            left: FAB_SIZE / 2,
            whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(10,20,40,0.84)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderRadius: 28,
            padding: "7px 18px 7px 13px",
            border: `1px solid ${gestureFeedback.color}45`,
            boxShadow: `0 8px 28px ${gestureFeedback.color}30, 0 2px 8px rgba(0,0,0,0.25)`,
            animation: "yaya-gesture-toast 2.2s ease-out forwards",
            pointerEvents: "none",
            zIndex: 20,
          }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{gestureFeedback.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: gestureFeedback.color, letterSpacing: 0.3 }}>
              {gestureFeedback.text}
            </span>
          </div>
        )}

        {/* 手势识别常驻后台，无需按钮 */}
      </div>

      {/* ── iOS-style frosted-glass panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-[85] w-[360px] max-w-[94vw] overflow-hidden rounded-[26px]"
          style={{
            left: panelLeft,
            top: panelTop,
            maxHeight: `calc(100vh - ${PANEL_MIN_MARGIN * 2}px)`,
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "saturate(180%) blur(24px)",
            WebkitBackdropFilter: "saturate(180%) blur(24px)",
            border: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset",
            animation: "yaya-slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: "linear-gradient(135deg,#4ade80,#16a34a)" }}
              >
                <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>芽</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">芽芽</div>
                <div className="flex items-center gap-1" style={{ marginTop: 1 }}>
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: voiceState === "thinking" ? "#f59e0b"
                        : voiceState === "speaking" ? "#ef4444"
                          : alwaysListening ? "#22c55e" : "#d1d5db",
                      boxShadow: alwaysListening ? "0 0 5px rgba(34,197,94,0.7)" : "none",
                      animation: alwaysListening ? "yaya-thinking-dot 2s ease-in-out infinite" : "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {voiceState === "thinking" ? "思考中..."
                      : voiceState === "speaking" ? "播报中"
                        : alwaysListening ? "持续监听"
                          : "待机"}
                  </span>
                  <span style={{
                    fontSize: 10, color: "#4ade80", fontWeight: 600,
                    background: "rgba(74,222,128,0.12)",
                    border: "1px solid rgba(74,222,128,0.3)",
                    borderRadius: 8,
                    padding: "0px 5px",
                    marginLeft: 2,
                  }}>
                    手势识别中
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.06)" }}
            >
              <X className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>

          {/* Message list */}
          <div
            className="h-60 space-y-2.5 overflow-y-auto px-4 py-3"
            style={{ scrollbarWidth: "none" }}
          >
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ animation: "yaya-msg-in 0.2s ease" }}
              >
                <div
                  className={`max-w-[78%] px-3.5 py-2 text-sm leading-relaxed ${m.role === "user" ? "rounded-[18px] rounded-tr-[5px]" : "rounded-[18px] rounded-tl-[5px]"
                    }`}
                  style={
                    m.role === "user"
                      ? {
                        background: "linear-gradient(135deg,#34d399,#16a34a)",
                        color: "#fff",
                        boxShadow: "0 2px 8px rgba(22,163,74,0.25)",
                      }
                      : {
                        background: "rgba(0,0,0,0.05)",
                        color: "#1f2937",
                        border: "1px solid rgba(0,0,0,0.04)",
                      }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* iOS-style typing indicator */}
            {voiceState === "thinking" && (
              <div className="flex justify-start" style={{ animation: "yaya-msg-in 0.2s ease" }}>
                <div
                  className="flex items-center gap-1.5 rounded-[18px] rounded-tl-[5px] px-4 py-3"
                  style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}
                >
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="h-2 w-2 rounded-full bg-gray-400"
                      style={{ animation: `yaya-thinking-dot 1.4s ease-in-out ${idx * 0.18}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live transcript pill */}
          {heardText && (
            <div className="mx-4 mb-2">
              <div
                className="flex items-center gap-2 rounded-full px-3 py-1.5"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}
              >
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="truncate text-xs text-emerald-700">{heardText}</span>
              </div>
            </div>
          )}

          {/* Input bar + footer */}
          <div className="px-3 pb-4">
            <div
              className="flex items-center gap-2 rounded-[14px] px-3 py-2"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const textToSend = input;
                    setInput("");
                    void executeUnified(textToSend);
                  }
                }}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                placeholder="输入指令..."
              />
              {voiceState === "speaking" && (
                <button
                  onClick={() => { window.speechSynthesis?.cancel(); setVoiceState("idle"); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white"
                >
                  <Square className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => {
                  const textToSend = input;
                  setInput("");
                  void executeUnified(textToSend);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg,#4ade80,#16a34a)" }}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between px-1">
              {voiceState === "speaking" ? (
                <div className="flex items-end gap-[3px]" style={{ height: 14 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-emerald-500"
                      style={{
                        height: "100%",
                        transformOrigin: "bottom",
                        animation: `yaya-wave 0.7s ease-in-out ${i * 0.1}s infinite`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-400">
                  {!speechSupported ? "浏览器不支持语音" : alwaysListening ? "持续监听中" : "监听未启动"}
                </span>
              )}
              <button
                onClick={alwaysListening ? stopAlwaysListening : startAlwaysListening}
                disabled={!speechSupported}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-all disabled:opacity-30"
                style={{
                  background: alwaysListening ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.05)",
                  color: alwaysListening ? "#16a34a" : "#9ca3af",
                  border: alwaysListening ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {alwaysListening ? "暂停监听" : "启动监听"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}