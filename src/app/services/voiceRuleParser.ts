/**
 * 语音规则解析服务
 *
 * 支持三种规则类型：
 * 1. SCHEDULE  - 定时规则，如"下午两点到四点开启补光灯"
 * 2. LINKAGE   - 联动规则，如"温度超过35度开启风机"
 * 3. THRESHOLD - 阈值告警，如"湿度低于30%报警"
 *
 * 优先使用前端本地正则解析（快速），复杂指令回退到后端 LLM 解析。
 */

import {
  createScheduleRule,
  fetchScheduleRules,
  deleteScheduleRule,
  type ScheduleRuleRequest,
  type ScheduleRuleResponse,
} from "./deviceControl";
import {
  createCompositeRule,
  fetchCompositeRules,
  deleteCompositeRule,
  type CompositeRuleRequest,
  type CompositeRuleResponse,
} from "./compositeCondition";
import {
  createThresholdRule,
  fetchThresholdRules,
  deleteThresholdRule,
  type ThresholdRuleRequest,
  type ThresholdRule,
} from "./thresholdAlert";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RuleType = "SCHEDULE" | "LINKAGE" | "THRESHOLD";

export interface ParsedSchedule {
  turnOnTime: string;   // HH:mm
  turnOffTime: string;  // HH:mm
  commandType: "LIGHT_CONTROL" | "MOTOR_CONTROL";
  /** 若为 true,表示用户想"取消/删除"该时间段的定时规则而非新增 */
  cancel?: boolean;
}

export interface ParsedCondition {
  sensorMetric: "temperature" | "humidity" | "luminance";
  operator: "GT" | "GTE" | "LT" | "LTE";
  threshold: number;
}

export interface ParsedLinkage {
  conditions: ParsedCondition[];
  logicOperator: "AND" | "OR";
  commandType: "LIGHT_CONTROL" | "MOTOR_CONTROL";
  commandAction: "ON" | "OFF";
  /** 取消匹配联动规则 */
  cancel?: boolean;
}

export interface ParsedThreshold {
  metric: "temperature" | "humidity" | "luminance";
  operator: "ABOVE" | "BELOW";
  threshold: number;
  /** 取消匹配阈值告警 */
  cancel?: boolean;
}

export interface VoiceRuleResult {
  ruleType: RuleType;
  ruleName: string;
  schedule?: ParsedSchedule;
  linkage?: ParsedLinkage;
  threshold?: ParsedThreshold;
  explanation: string;
}

export type RuleCreationResult =
  | { ruleType: "SCHEDULE"; rule: ScheduleRuleResponse; explanation: string }
  | { ruleType: "LINKAGE"; rule: CompositeRuleResponse; explanation: string }
  | { ruleType: "THRESHOLD"; rule: ThresholdRule; explanation: string };

// ─── Chinese number parsing ─────────────────────────────────────────────────

const CN_NUM: Record<string, number> = {
  "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
  "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
};

function parseCnNum(s: string): number | null {
  // Pure digit
  const n = parseInt(s, 10);
  if (!isNaN(n)) return n;

  // Single Chinese digit
  if (CN_NUM[s] !== undefined) return CN_NUM[s];

  // "十" = 10
  if (s === "十") return 10;
  // "十X" = 10+X
  if (s.startsWith("十") && s.length === 2 && CN_NUM[s[1]] !== undefined) {
    return 10 + CN_NUM[s[1]];
  }
  // "X十" = X*10
  if (s.endsWith("十") && s.length === 2 && CN_NUM[s[0]] !== undefined) {
    return CN_NUM[s[0]] * 10;
  }
  // "X十Y" = X*10+Y
  const m = s.match(/^(.)十(.)$/);
  if (m && CN_NUM[m[1]] !== undefined && CN_NUM[m[2]] !== undefined) {
    return CN_NUM[m[1]] * 10 + CN_NUM[m[2]];
  }

  return null;
}

// ─── Time parsing ───────────────────────────────────────────────────────────

/**
 * Parse Chinese time expression to HH:mm
 * e.g. "下午两点" → "14:00", "上午九点半" → "09:30"
 */
function parseTimeExpr(
  period: string | undefined,
  hourStr: string,
  minutePart: string | undefined,
): string | null {
  const hour = parseCnNum(hourStr);
  if (hour == null || hour < 0 || hour > 24) return null;

  let minute = 0;
  if (minutePart) {
    if (minutePart === "半") {
      minute = 30;
    } else {
      const m = parseCnNum(minutePart.replace(/分$/, ""));
      if (m != null) minute = m;
    }
  }

  let h = hour;
  if (period) {
    if (/下午|晚上|傍晚/.test(period) && h < 12) h += 12;
    // 上午/早上/凌晨: keep as is
  } else {
    // No period specified: 1-6 → assume PM for agriculture context
    if (h >= 1 && h <= 6) h += 12;
  }

  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Time regex: captures (period?)(hour)(minute?)
const TIME_RE =
  /(?:(上午|早上|凌晨|下午|晚上|傍晚)\s*)?([\d一二两三四五六七八九十]+)\s*[点时:：]\s*(半|[\d一二三四五六七八九十]+分?)?/;

// Full time range: TIME1 到/至 TIME2
const TIME_RANGE_RE = new RegExp(
  `(?:(上午|早上|凌晨|下午|晚上|傍晚)\\s*)?([\\d一二两三四五六七八九十]+)\\s*[点时:：]\\s*(半|[\\d一二三四五六七八九十]+分?)?` +
  `\\s*[到至\\-~]+\\s*` +
  `(?:(上午|早上|凌晨|下午|晚上|傍晚)\\s*)?([\\d一二两三四五六七八九十]+)\\s*[点时:：]\\s*(半|[\\d一二三四五六七八九十]+分?)?`,
);

// ─── Device/action matching ─────────────────────────────────────────────────

type DeviceType = "LIGHT_CONTROL" | "MOTOR_CONTROL";

function matchDevice(text: string): DeviceType | null {
  if (/(补光灯|灯光|灯|照明|补光|开灯|关灯|亮灯|点灯|灯泡|日光灯|led|LED)/.test(text)) return "LIGHT_CONTROL";
  if (/(风机|风扇|电机|马达|通风|排风|吹风|换气|散热|扇子|鼓风)/.test(text)) return "MOTOR_CONTROL";
  return null;
}

function matchAction(text: string): "ON" | "OFF" {
  if (/(关闭|关掉|关了|关上|停止|停掉|停了|熄灭|熄了|断开|别开|不要开|关一下|给我关|帮我关|把.*关)/.test(text)) return "OFF";
  // ON: very broad — any mention of opening/starting/enabling
  return "ON";
}
// ── Cancel/delete intent for existing rules ──
const CANCEL_VERB_RE = /(取消|删除|移除|去掉|废除|拆了|拆除|不要(了)?|别要(了)?|干掉)/;
function detectCancelVerb(text: string): boolean {
  return CANCEL_VERB_RE.test(text);
}
// ─── Sensor metric matching ─────────────────────────────────────────────────

type SensorMetric = "temperature" | "humidity" | "luminance";

function matchMetric(text: string): SensorMetric | null {
  if (/(温度|气温|度数|热|冷|凉|闷热|高温|低温|太热|太冷|热死|冷死|升温|降温)/.test(text)) return "temperature";
  if (/(湿度|水分|干燥|潮湿|干了|湿了|太干|太湿|缺水|水汽|发干|发潮)/.test(text)) return "humidity";
  if (/(光照|光强|光线|亮度|天黑|太暗|天亮|暗了|亮了|阳光|日照|光不够|光太强)/.test(text)) return "luminance";
  return null;
}

// ─── Threshold value extraction ─────────────────────────────────────────────

const THRESHOLD_VALUE_RE = /([\d一二两三四五六七八九十百千]+\.?\d*)\s*[度℃%％]?/;

function extractThresholdValue(text: string): number | null {
  // Try to find a number near the condition keywords
  const m = text.match(/([\d]+\.?\d*)/);
  if (m) return parseFloat(m[1]);
  // Try Chinese numbers
  const cnm = text.match(/([一二两三四五六七八九十百千]+)/);
  if (cnm) {
    const n = parseCnNum(cnm[1]);
    if (n != null) return n;
  }
  return null;
}

// ─── Condition operator matching ────────────────────────────────────────────

type CondOp = "GT" | "GTE" | "LT" | "LTE";
type ThreshOp = "ABOVE" | "BELOW";

function matchConditionOp(text: string): { cond: CondOp; thresh: ThreshOp } {
  if (/(大于等于|不小于|>=|≥)/.test(text)) return { cond: "GTE", thresh: "ABOVE" };
  if (/(小于等于|不大于|<=|≤)/.test(text)) return { cond: "LTE", thresh: "BELOW" };
  if (/(超过|高于|大于|超出|高出|达到|到了|上了|太高|过高|偏高|热|闷热|太热|热死|太亮|光太强|>)/.test(text)) return { cond: "GT", thresh: "ABOVE" };
  if (/(低于|小于|不足|低过|不到|太低|过低|偏低|冷|太冷|冷死|太暗|太干|干了|缺水|<)/.test(text)) return { cond: "LT", thresh: "BELOW" };
  // Default
  return { cond: "GT", thresh: "ABOVE" };
}

// ─── Rule intent detection ──────────────────────────────────────────────────

/**
 * Check if the text is a rule-creation command.
 *
 * 设计原则：宁可误放也不漏放。
 * 如果判断错了，后面 parseRuleLocally / LLM 还会再做一道验证。
 * 但如果这里拦住了，后续根本没机会处理。
 */
export function isRuleCreationIntent(text: string): boolean {
  const t = text.replace(/\s+/g, "");
  // ── 0. Explicit cancel/delete on rules — always treat as rule operation
  //    例："取消下午2点到4点的补光灯"，"删除温度告警"，"不要联动了"
  if (CANCEL_VERB_RE.test(t)) {
    if (/(规则|定时|联动|告警|报警|阈值|自动|计划|安排|提醒|预警)/.test(t)) return true;
    if (TIME_RANGE_RE.test(t) || TIME_RE.test(t)) return true;
    if (matchDevice(t) || matchMetric(t)) return true;
  }
  // ── 1. Explicit rule-setting verbs（显式设规则意图）
  if (/(设定|设置|新增|添加|创建|配置|制定|建立|弄一?个|搞一?个|加一?个|来一?个|整一?个|帮我|给我).*(规则|定时|联动|告警|报警|自动|计划|安排)/.test(t)) return true;

  // ── 2. Schedule intent（定时意图，无需精确格式）
  //    "帮我定个时"、"每天X到Y"、"几点开灯"
  const hasDevice = matchDevice(t) !== null;
  const hasAction = /(开启|关闭|开|关|启动|停止|打开|关掉|启用|停用|开一下|关一下|开开|关关|开了|关了)/.test(t);
  const hasTime = TIME_RANGE_RE.test(t) || /(每天|每日|每晚|白天|晚上|夜里|中午|早上|下午|傍晚|凌晨|上午)/.test(t);
  const hasTimeSingle = TIME_RE.test(t);

  // 时间段 + 设备/动作 → 定时规则
  if (TIME_RANGE_RE.test(t) && (hasDevice || hasAction)) return true;
  // 时间词 + 设备 + 动作
  if (hasTime && hasDevice) return true;
  // 单个时间点 + 设备
  if (hasTimeSingle && hasDevice) return true;
  // "定个时" / "自动开灯" / "定时开风扇"
  if (/(定时|定个时|自动|自动化|按时|准时)/.test(t) && (hasDevice || hasAction)) return true;

  // ── 3. Linkage intent（联动意图：条件 + 动作）
  const hasMetric = matchMetric(t) !== null;
  // 宽泛的条件词，不只是"超过"，还包括"太热了"、"温度上来了"
  const hasCondition = /(超过|高于|大于|低于|小于|不足|达到|到了|上了|上来|下来|太高|太低|过高|过低|偏高|偏低|超了|爆了)/.test(t);
  // 隐含条件的口语："太热"、"太冷"、"太暗"、"太干"
  const hasImpliedCondition = /(太热|热死|闷热|太冷|冷死|太暗|天黑|光不够|太亮|光太强|太干|干了|发干|太湿|发潮|潮湿|缺水)/.test(t);

  // 传感器 + 条件 + 设备 → 联动
  if (hasMetric && hasCondition && hasDevice) return true;
  // 传感器 + 条件 + 动作 → 联动
  if (hasMetric && hasCondition && hasAction) return true;
  // 隐含条件 + 设备/动作 → 联动（"太热了开风扇"）
  if (hasImpliedCondition && (hasDevice || hasAction)) return true;
  // 纯隐含条件（有传感器上下文） + 设备
  if (hasMetric && hasDevice && hasAction) return true;

  // ── 4. Threshold alert intent（告警意图）
  const hasAlert = /(报警|告警|预警|提醒|通知|警报|警告|提示一下|告诉我|通知我|发消息|发短信|发通知)/.test(t);
  // 传感器 + 条件 + 告警
  if (hasMetric && hasCondition && hasAlert) return true;
  // 传感器 + 告警（"温度报警"、"湿度告诉我"）
  if (hasMetric && hasAlert) return true;
  // 隐含条件 + 告警（"太热了提醒我"）
  if (hasImpliedCondition && hasAlert) return true;

  // ── 5. Very colloquial catch-all（极口语化兜底）
  //    "帮我把灯开了"、"给我通通风"、"帮我安排一下灯"
  if (/(帮我|给我|麻烦|请).*(开|关|通|停|安排|弄|搞)/.test(t) && hasDevice) return true;
  //    "XX的时候开灯" / "XX就开风扇"
  if (/(的时候|的话|时候|就|就把|则|那就)/.test(t) && hasDevice && (hasMetric || hasCondition || hasImpliedCondition)) return true;

  return false;
}

// ─── Local rule parsing ─────────────────────────────────────────────────────

/** Try to parse voice command locally using regex. Returns null if unable to parse. */
export function parseRuleLocally(text: string): VoiceRuleResult | null {
  const t = text.replace(/\s+/g, "");

  // ── 1. Schedule rule: time range + device action ──
  const timeMatch = t.match(TIME_RANGE_RE);
  if (timeMatch) {
    const device = matchDevice(t);
    if (device) {
      const startTime = parseTimeExpr(timeMatch[1], timeMatch[2], timeMatch[3]);
      const endTime = parseTimeExpr(timeMatch[4] || timeMatch[1], timeMatch[5], timeMatch[6]);
      if (startTime && endTime) {
        const deviceLabel = device === "LIGHT_CONTROL" ? "补光灯" : "风机";
        const isCancel = matchAction(t) === "OFF";
        return {
          ruleType: "SCHEDULE",
          ruleName: `语音定时-${deviceLabel}(${startTime}~${endTime})`,
          schedule: {
            turnOnTime: startTime,
            turnOffTime: endTime,
            commandType: device,
            cancel: isCancel,
          },
          explanation: isCancel
            ? `取消${startTime}到${endTime}的${deviceLabel}定时规则`
            : `${startTime}到${endTime}开启${deviceLabel}`,
        };
      }
    }
  }

  // ── 2. Threshold alert: sensor + condition + alert keyword ──
  const metric = matchMetric(t);
  if (metric && /(报警|告警|预警|提醒|通知|警报|告诉我|通知我|提示|发消息)/.test(t)) {
    const op = matchConditionOp(t);
    const value = extractThresholdValue(t);
    if (value != null) {
      const metricLabel = metric === "temperature" ? "温度" : metric === "humidity" ? "湿度" : "光照";
      const opLabel = op.thresh === "ABOVE" ? "高于" : "低于";
      const isCancel = detectCancelVerb(t);
      return {
        ruleType: "THRESHOLD",
        ruleName: `语音告警-${metricLabel}${opLabel}${value}`,
        threshold: { metric, operator: op.thresh, threshold: value, cancel: isCancel },
        explanation: isCancel
          ? `取消“${metricLabel}${opLabel}${value}时告警”的阈值规则`
          : `当${metricLabel}${opLabel}${value}时触发告警`,
      };
    }
  }
  // 2b. Cancel 阈值告警 — 只要“取消温度告警”，无需具体阈值
  if (metric && detectCancelVerb(t) && /(告警|报警|预警|提醒|通知|阈值)/.test(t)) {
    const op = matchConditionOp(t);
    const value = extractThresholdValue(t);
    const metricLabel = metric === "temperature" ? "温度" : metric === "humidity" ? "湿度" : "光照";
    return {
      ruleType: "THRESHOLD",
      ruleName: `语音取消告警-${metricLabel}`,
      threshold: { metric, operator: op.thresh, threshold: value ?? 0, cancel: true },
      explanation: `取消${metricLabel}告警规则`,
    };
  }

  // ── 3. Linkage rule: sensor + condition + device action ──
  if (metric) {
    const device = matchDevice(t);
    if (device && /(超过|高于|大于|低于|小于|不足|达到|到了|上了|太高|太低|过高|过低|偏高|偏低)/.test(t)) {
      const op = matchConditionOp(t);
      const value = extractThresholdValue(t);
      const action = matchAction(t);
      if (value != null) {
        const metricLabel = metric === "temperature" ? "温度" : metric === "humidity" ? "湿度" : "光照";
        const opLabel = op.cond === "GT" ? "超过" : op.cond === "LT" ? "低于" : op.cond === "GTE" ? "达到" : "不超过";
        const deviceLabel = device === "LIGHT_CONTROL" ? "补光灯" : "风机";
        const actionLabel = action === "ON" ? "开启" : "关闭";
        const isCancel = detectCancelVerb(t);
        return {
          ruleType: "LINKAGE",
          ruleName: `语音联动-${metricLabel}${opLabel}${value}${actionLabel}${deviceLabel}`,
          linkage: {
            conditions: [{ sensorMetric: metric, operator: op.cond, threshold: value }],
            logicOperator: "AND",
            commandType: device,
            commandAction: action,
            cancel: isCancel,
          },
          explanation: isCancel
            ? `取消“${metricLabel}${opLabel}${value}${actionLabel}${deviceLabel}”的联动规则`
            : `当${metricLabel}${opLabel}${value}时${actionLabel}${deviceLabel}`,
        };
      }
    }
  }

  return null;
}

// ─── Backend LLM parsing fallback ───────────────────────────────────────────

const SMART_DECISION_BASE = "/api/v1/smart-decision";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export async function parseRuleViaLLM(command: string): Promise<VoiceRuleResult> {
  const res = await fetch(`${SMART_DECISION_BASE}/parse-voice-rule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(`规则解析请求失败: ${res.status}`);
  const json: ApiResponse<VoiceRuleResult> = await res.json();
  if (json.code !== 0) throw new Error(json.message || "规则解析失败");
  return json.data;
}

// ─── Rule dispatch: create the parsed rule via the appropriate API ───────────

/**
 * 将解析后的语音规则分发到对应的后端服务创建
 */
export async function dispatchRuleCreation(
  parsed: VoiceRuleResult,
  deviceId: string,
): Promise<RuleCreationResult> {
  switch (parsed.ruleType) {
    case "SCHEDULE": {
      if (!parsed.schedule) throw new Error("缺少定时规则参数");
      // ── 取消/删除路径: 用户说"关闭X点到Y点的灯" → 找到匹配的规则并删除
      if (parsed.schedule.cancel) {
        const all = await fetchScheduleRules();
        const want = parsed.schedule;
        // 主键:同一 deviceId 上同一开关时间段。commandType 老数据可能为空,做宽松匹配
        const target = all.find(
          (r) =>
            r.deviceId === deviceId &&
            r.turnOnTime.slice(0, 5) === want.turnOnTime &&
            r.turnOffTime.slice(0, 5) === want.turnOffTime &&
            (!r.commandType || r.commandType === want.commandType),
        );
        if (!target) {
          // 二次兜底:不要求时间完全一致,按 commandType 匹配最近的一条
          const fallback = all.find(
            (r) => r.deviceId === deviceId && (r.commandType ?? "LIGHT_CONTROL") === want.commandType,
          );
          if (!fallback) {
            throw new Error(`未找到 ${want.turnOnTime}~${want.turnOffTime} 的定时规则,无需取消`);
          }
          await deleteScheduleRule(fallback.id);
          return { ruleType: "SCHEDULE", rule: fallback, explanation: parsed.explanation };
        }
        await deleteScheduleRule(target.id);
        return {
          ruleType: "SCHEDULE",
          rule: target,
          explanation: parsed.explanation,
        };
      }
      // ── 新建路径
      const req: ScheduleRuleRequest = {
        deviceId,
        ruleName: parsed.ruleName,
        turnOnTime: parsed.schedule.turnOnTime,
        turnOffTime: parsed.schedule.turnOffTime,
        commandType: parsed.schedule.commandType,
        enabled: true,
      };
      const rule = await createScheduleRule(req);
      return { ruleType: "SCHEDULE", rule, explanation: parsed.explanation };
    }

    case "LINKAGE": {
      if (!parsed.linkage) throw new Error("缺少联动规则参数");
      // ── 取消路径
      if (parsed.linkage.cancel) {
        const all = await fetchCompositeRules();
        const want = parsed.linkage;
        const target = all.find((r) => {
          if (r.commandType !== want.commandType) return false;
          if (r.commandAction !== want.commandAction) return false;
          if (r.targetDeviceId !== deviceId) return false;
          // 匹配主条件
          const cond = want.conditions[0];
          return r.conditions.some(
            (c) =>
              c.sensorMetric === cond.sensorMetric &&
              c.operator === cond.operator &&
              Number(c.threshold) === Number(cond.threshold),
          );
        });
        if (!target) throw new Error(`未找到匹配的联动规则，无需取消`);
        await deleteCompositeRule(target.id);
        return { ruleType: "LINKAGE", rule: target, explanation: parsed.explanation };
      }
      // ── 新建路径
      const req: CompositeRuleRequest = {
        name: parsed.ruleName,
        description: `语音创建: ${parsed.explanation}`,
        logicOperator: parsed.linkage.logicOperator,
        enabled: true,
        targetDeviceId: deviceId,
        commandType: parsed.linkage.commandType,
        commandAction: parsed.linkage.commandAction,
        conditions: parsed.linkage.conditions.map((c) => ({
          sensorMetric: c.sensorMetric,
          sourceDeviceId: deviceId,
          operator: c.operator as "GT" | "GTE" | "LT" | "LTE" | "EQ" | "NEQ",
          threshold: c.threshold,
        })),
      };
      const rule = await createCompositeRule(req);
      return { ruleType: "LINKAGE", rule, explanation: parsed.explanation };
    }

    case "THRESHOLD": {
      if (!parsed.threshold) throw new Error("缺少阈值告警参数");
      // ── 取消路径
      if (parsed.threshold.cancel) {
        const all = await fetchThresholdRules();
        const want = parsed.threshold;
        // 如果指定了阈值，精准匹配；否则匹配 metric+该 deviceId 的任一告警
        const target = all.find((r) =>
          r.deviceId === deviceId &&
          r.metric === want.metric &&
          (want.threshold === 0 ||
            (r.operator === want.operator &&
              Number(r.threshold) === Number(want.threshold))),
        );
        if (!target) throw new Error(`未找到匹配的告警规则，无需取消`);
        await deleteThresholdRule(target.id);
        return { ruleType: "THRESHOLD", rule: target, explanation: parsed.explanation };
      }
      // ── 新建路径
      const req: ThresholdRuleRequest = {
        deviceId,
        metric: parsed.threshold.metric,
        operator: parsed.threshold.operator,
        threshold: parsed.threshold.threshold,
        enabled: true,
      };
      const rule = await createThresholdRule(req);
      return { ruleType: "THRESHOLD", rule, explanation: parsed.explanation };
    }

    default:
      throw new Error(`未知规则类型: ${parsed.ruleType}`);
  }
}

// ─── Unified entry point ────────────────────────────────────────────────────

/**
 * 解析语音指令并创建规则（本地优先，LLM 回退）
 */
export async function parseAndCreateRule(
  voiceText: string,
  deviceId: string,
): Promise<RuleCreationResult> {
  // 1. Try local regex parsing first (instant)
  let parsed = parseRuleLocally(voiceText);

  // 2. Fallback to backend LLM parsing
  if (!parsed) {
    parsed = await parseRuleViaLLM(voiceText);
    if (parsed.ruleType === ("UNKNOWN" as RuleType)) {
      throw new Error(parsed.explanation || "无法解析语音指令");
    }
  }

  // 2.5 兜底注入 cancel 意图——无论本地还是 LLM 路径,只要原话出现了取消动词
  //    或对定时规则说"关闭/关掉",就强制走删除分支,避免重复创建报错。
  const t = voiceText.replace(/\s+/g, "");
  const cancelByVerb = detectCancelVerb(t);
  const cancelByOff = matchAction(t) === "OFF"; // 仅对 SCHEDULE 有效
  if (parsed.ruleType === "SCHEDULE" && parsed.schedule) {
    if (cancelByVerb || cancelByOff) {
      parsed.schedule.cancel = true;
      if (!/^取消/.test(parsed.explanation)) {
        parsed.explanation = `取消${parsed.schedule.turnOnTime}到${parsed.schedule.turnOffTime}的${
          parsed.schedule.commandType === "LIGHT_CONTROL" ? "补光灯" : "风机"
        }定时规则`;
      }
    }
  } else if (parsed.ruleType === "LINKAGE" && parsed.linkage && cancelByVerb) {
    parsed.linkage.cancel = true;
    if (!/^取消/.test(parsed.explanation)) parsed.explanation = `取消${parsed.explanation}`;
  } else if (parsed.ruleType === "THRESHOLD" && parsed.threshold && cancelByVerb) {
    parsed.threshold.cancel = true;
    if (!/^取消/.test(parsed.explanation)) parsed.explanation = `取消${parsed.explanation}`;
  }

  // 3. Dispatch to the appropriate service
  return dispatchRuleCreation(parsed, deviceId);
}

// ─── Rule query intent (列出规则) ────────────────────────────────────────────

export type RuleQueryKind = "ALL" | "SCHEDULE" | "LINKAGE" | "THRESHOLD";

/** 检测"有哪些规则/查看告警"等查询意图,并返回想查询的种类 */
export function parseRuleQueryIntent(text: string): RuleQueryKind | null {
  const t = text.replace(/\s+/g, "");
  // 必须包含查询动词
  const hasQueryVerb = /(查看|看看|看一下|有哪些|有什么|有几个|多少个|列出|列表|查询|有多少|展示|显示|看下)/.test(t);
  if (!hasQueryVerb) return null;

  // 必须涉及规则
  const hasRuleNoun = /(规则|定时|联动|告警|报警|预警|阈值|计划|安排|自动化)/.test(t);
  if (!hasRuleNoun) return null;

  if (/定时|计划|安排/.test(t)) return "SCHEDULE";
  if (/联动|自动化/.test(t)) return "LINKAGE";
  if (/告警|报警|预警|阈值/.test(t)) return "THRESHOLD";
  return "ALL";
}

export interface RuleQueryResult {
  kind: RuleQueryKind;
  schedules: ScheduleRuleResponse[];
  linkages: CompositeRuleResponse[];
  thresholds: ThresholdRule[];
  /** 给用户朗读/展示的中文摘要 */
  summary: string;
}

/** 调用后端 fetch 各类规则,生成中文摘要 */
export async function fetchRulesSummary(
  kind: RuleQueryKind,
  deviceId: string,
): Promise<RuleQueryResult> {
  const wantSch = kind === "ALL" || kind === "SCHEDULE";
  const wantLnk = kind === "ALL" || kind === "LINKAGE";
  const wantThr = kind === "ALL" || kind === "THRESHOLD";

  const [schedules, linkages, thresholds] = await Promise.all([
    wantSch ? fetchScheduleRules().catch(() => []) : Promise.resolve([] as ScheduleRuleResponse[]),
    wantLnk ? fetchCompositeRules().catch(() => []) : Promise.resolve([] as CompositeRuleResponse[]),
    wantThr ? fetchThresholdRules().catch(() => []) : Promise.resolve([] as ThresholdRule[]),
  ]);

  const mySch = schedules.filter((r) => r.deviceId === deviceId);
  const myLnk = linkages.filter((r) => r.targetDeviceId === deviceId);
  const myThr = thresholds.filter((r) => r.deviceId === deviceId);

  const lines: string[] = [];
  if (wantSch) {
    if (mySch.length === 0) lines.push("没有定时规则");
    else {
      lines.push(`定时规则 ${mySch.length} 条:`);
      mySch.slice(0, 5).forEach((r) => {
        const dev = (r.commandType ?? "LIGHT_CONTROL") === "LIGHT_CONTROL" ? "补光灯" : "风机";
        lines.push(`· ${dev} ${r.turnOnTime.slice(0, 5)}~${r.turnOffTime.slice(0, 5)}${r.enabled ? "" : " (已停用)"}`);
      });
      if (mySch.length > 5) lines.push(`...还有 ${mySch.length - 5} 条`);
    }
  }
  if (wantLnk) {
    if (myLnk.length === 0) lines.push("没有联动规则");
    else {
      lines.push(`联动规则 ${myLnk.length} 条:`);
      myLnk.slice(0, 5).forEach((r) => {
        const cond = r.conditions[0];
        const metric = cond?.sensorMetric === "temperature" ? "温度"
          : cond?.sensorMetric === "humidity" ? "湿度" : "光照";
        const opLabel = cond?.operator === "GT" ? "超过" : cond?.operator === "LT" ? "低于" : cond?.operator;
        const dev = r.commandType === "LIGHT_CONTROL" ? "补光灯" : "风机";
        const act = r.commandAction === "ON" ? "开启" : "关闭";
        lines.push(`· ${metric}${opLabel}${cond?.threshold} → ${act}${dev}${r.enabled ? "" : " (已停用)"}`);
      });
      if (myLnk.length > 5) lines.push(`...还有 ${myLnk.length - 5} 条`);
    }
  }
  if (wantThr) {
    if (myThr.length === 0) lines.push("没有阈值告警规则");
    else {
      lines.push(`告警规则 ${myThr.length} 条:`);
      myThr.slice(0, 5).forEach((r) => {
        const metric = r.metric === "temperature" ? "温度"
          : r.metric === "humidity" ? "湿度" : "光照";
        const opLabel = r.operator === "ABOVE" ? "高于" : "低于";
        lines.push(`· ${metric}${opLabel}${r.threshold}${r.enabled ? "" : " (已停用)"}`);
      });
      if (myThr.length > 5) lines.push(`...还有 ${myThr.length - 5} 条`);
    }
  }

  return {
    kind,
    schedules: mySch,
    linkages: myLnk,
    thresholds: myThr,
    summary: lines.join("\n") || "暂无规则",
  };
}
