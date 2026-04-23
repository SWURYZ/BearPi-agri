import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { useNavigate } from "react-router";
import { executeDecision, type SensorSnapshot } from "../services/smartDecision";
import { streamAgriAgentChat } from "../services/agriAgent";
import { sendManualControl } from "../services/deviceControl";
import { isRuleCreationIntent, parseAndCreateRule, parseRuleQueryIntent, fetchRulesSummary } from "../services/voiceRuleParser";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

// ─── Web Speech API declarations ───────────────────────────────────────────
interface ISpeechRecognitionResult {
  readonly [index: number]: { transcript: string; confidence: number };
  readonly length: number;
}
interface ISpeechRecognitionResultList {
  readonly [index: number]: ISpeechRecognitionResult;
  readonly length: number;
}
interface ISpeechRecognitionEvent extends Event {
  readonly results: ISpeechRecognitionResultList;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror:  (() => void) | null;
  onend:    (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// ─── CSS Keyframes ──────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes yaya-float {
  0%   { transform: translateY(0px) rotate(-1deg); }
  30%  { transform: translateY(-10px) rotate(0.5deg); }
  60%  { transform: translateY(-16px) rotate(1deg); }
  100% { transform: translateY(0px) rotate(-1deg); }
}
@keyframes yaya-bob {
  0%   { transform: translateY(0px) scale(1) rotate(0deg); }
  25%  { transform: translateY(-6px) scale(1.03) rotate(-1deg); }
  75%  { transform: translateY(-3px) scale(1.015) rotate(1deg); }
  100% { transform: translateY(0px) scale(1) rotate(0deg); }
}
@keyframes yaya-mouth {
  0%   { transform: scaleY(0.3) scaleX(0.9); }
  40%  { transform: scaleY(1.7) scaleX(1.1); }
  70%  { transform: scaleY(0.8) scaleX(1.0); }
  100% { transform: scaleY(0.3) scaleX(0.9); }
}
@keyframes yaya-blink {
  0%, 90%, 100% { transform: scaleY(1); }
  94%           { transform: scaleY(0.05); }
}
@keyframes yaya-sway {
  0%, 100% { transform: rotate(-2deg) translateY(0); }
  50%      { transform: rotate(2deg) translateY(-4px); }
}
@keyframes pulse-ring {
  0%   { transform: scale(1);   opacity: 0.85; }
  100% { transform: scale(2.6); opacity: 0; }
}
@keyframes pulse-soft {
  0%, 100% { transform: scale(1);    opacity: 0.28; }
  50%      { transform: scale(1.12); opacity: 0.72; }
}
@keyframes orbit {
  0%   { transform: rotate(0deg)   translateX(108px) rotate(0deg); }
  100% { transform: rotate(360deg) translateX(108px) rotate(-360deg); }
}
@keyframes orbit-rev {
  0%   { transform: rotate(0deg)   translateX(82px) rotate(0deg); }
  100% { transform: rotate(-360deg) translateX(82px) rotate(360deg); }
}
@keyframes wave-bar {
  0%   { height: 4px;  opacity: 0.6; }
  50%  { height: 40px; opacity: 1; }
  100% { height: 4px;  opacity: 0.6; }
}
@keyframes speak-wave {
  0%, 100% { transform: scaleY(1);   opacity: 0.5; }
  50%       { transform: scaleY(2.4); opacity: 1; }
}
@keyframes spin-btn {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes sub-in {
  from { opacity: 0; transform: translateY(9px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sparkle {
  0%   { opacity: 0; transform: scale(0) translateY(0); }
  40%  { opacity: 1; transform: scale(1.2) translateY(-18px); }
  100% { opacity: 0; transform: scale(0.6) translateY(-38px); }
}
@keyframes particle {
  0%   { opacity: 1; transform: translate(0,0) scale(1); }
  100% { opacity: 0; transform: translate(var(--px),var(--py)) scale(0.3); }
}
`;

// ─── Status labels ──────────────────────────────────────────────────────────
const STATUS: Record<VoiceState, string> = {
  idle:      "\u82bd\u82bd\u5728\u8fd9\u91cc\uff0c\u8bf4\u51fa\u4f60\u7684\u60f3\u6cd5 \u2728",
  listening: "\u6211\u5728\u8ba4\u771f\u542c\u2026",
  thinking:  "\u8ba9\u6211\u60f3\u4e00\u60f3\u2026",
  speaking:  "\u82bd\u82bd\u8bf4\uff1a",
};

// ─── YayaAvatar SVG ─────────────────────────────────────────────────────────
function YayaAvatar({ state }: { state: VoiceState }) {
  const thinking  = state === "thinking";
  const listening = state === "listening";
  const speaking  = state === "speaking";

  const eyeW = listening ? 11 : 9;
  const eyeH = listening ? 13 : 10;

  return (
    <svg
      width="210"
      height="210"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        animation:
          state === "idle"
            ? "yaya-float 4s ease-in-out infinite"
            : speaking
            ? "yaya-bob 0.38s ease-in-out infinite"
            : thinking
            ? "yaya-sway 2s ease-in-out infinite"
            : "none",
        filter: speaking
          ? "drop-shadow(0 8px 28px rgba(74,222,128,0.75)) drop-shadow(0 0 18px rgba(74,222,128,0.5))"
          : "drop-shadow(0 14px 36px rgba(34,197,94,0.5))",
        zIndex: 1,
        transition: "filter 0.4s ease",
      }}
    >
      <defs>
        <radialGradient id="vf-face" cx="38%" cy="32%" r="62%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="vf-leaf" cx="28%" cy="20%" r="72%">
          <stop offset="0%"   stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#4ade80" />
        </radialGradient>
      </defs>

      {/* Leaves */}
      <ellipse cx="57"  cy="34" rx="22" ry="30" fill="url(#vf-leaf)" opacity="0.95" transform="rotate(-28 57 34)" />
      <ellipse cx="103" cy="32" rx="22" ry="30" fill="url(#vf-leaf)" opacity="0.85" transform="rotate(28 103 32)" />

      {/* Stem */}
      <rect x="77" y="42" width="6" height="26" rx="3" fill="#86efac" />

      {/* Face */}
      <circle cx="80" cy="100" r="54" fill="url(#vf-face)" />

      {/* Sheen */}
      <ellipse cx="62" cy="76" rx="18" ry="11" fill="rgba(255,255,255,0.14)" transform="rotate(-30 62 76)" />

      {/* Blush */}
      <ellipse cx="46"  cy="108" rx="13" ry="8"  fill="rgba(253,164,175,0.48)" />
      <ellipse cx="114" cy="108" rx="13" ry="8"  fill="rgba(253,164,175,0.48)" />

      {/* Eyes */}
      {thinking ? (
        <>
          {/* squint / tilted eyes while thinking */}
          <path d="M55 87 Q66 80 77 87"  stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M83 87 Q94 80 105 87" stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* small stars near eyes while thinking */}
          <text x="48" y="78" fontSize="9" fill="rgba(253,224,71,0.85)" style={{ animation: "sparkle 1.8s ease-in-out 0.2s infinite" }}>✦</text>
          <text x="107" y="76" fontSize="7" fill="rgba(167,243,208,0.85)" style={{ animation: "sparkle 1.8s ease-in-out 0.7s infinite" }}>✦</text>
        </>
      ) : (
        <>
          <ellipse cx="66" cy="86" rx={eyeW} ry={eyeH} fill="rgba(255,255,255,0.92)"
            style={state === "idle" ? { animation: "yaya-blink 4s ease-in-out infinite", transformBox: "fill-box" as React.CSSProperties["transformBox"], transformOrigin: "center" } as React.CSSProperties : {}}
          />
          <ellipse cx="94" cy="86" rx={eyeW} ry={eyeH} fill="rgba(255,255,255,0.92)"
            style={state === "idle" ? { animation: "yaya-blink 4s ease-in-out 0.06s infinite", transformBox: "fill-box" as React.CSSProperties["transformBox"], transformOrigin: "center" } as React.CSSProperties : {}}
          />
          <circle  cx="67" cy="88" r={listening ? 6.5 : 5.2} fill="#15803d" />
          <circle  cx="95" cy="88" r={listening ? 6.5 : 5.2} fill="#15803d" />
          <circle  cx="69.5" cy="85.5" r="2.2" fill="rgba(255,255,255,0.88)" />
          <circle  cx="97.5" cy="85.5" r="2.2" fill="rgba(255,255,255,0.88)" />
          {/* sparkle in eyes when speaking */}
          {speaking && <>
            <circle cx="63" cy="83" r="1" fill="rgba(253,224,71,0.9)" style={{ animation: "sparkle 0.9s ease-in-out infinite" }} />
            <circle cx="91" cy="83" r="1" fill="rgba(253,224,71,0.9)" style={{ animation: "sparkle 0.9s ease-in-out 0.18s infinite" }} />
          </>}
        </>
      )}

      {/* Mouth */}
      {speaking ? (
        <>
          <ellipse
            cx="80" cy="114" rx="12" ry="8"
            fill="rgba(255,255,255,0.92)"
            style={{
              animation: "yaya-mouth 0.28s cubic-bezier(0.4,0,0.6,1) infinite",
              transformBox: "fill-box" as React.CSSProperties["transformBox"],
              transformOrigin: "center",
            } as React.CSSProperties}
          />
          {/* inner mouth shadow */}
          <ellipse cx="80" cy="116" rx="7" ry="4" fill="rgba(21,128,61,0.25)"
            style={{
              animation: "yaya-mouth 0.28s cubic-bezier(0.4,0,0.6,1) infinite",
              transformBox: "fill-box" as React.CSSProperties["transformBox"],
              transformOrigin: "center",
            } as React.CSSProperties}
          />
        </>
      ) : listening ? (
        <>
          <ellipse cx="80" cy="113" rx="10" ry="8" fill="rgba(255,255,255,0.88)" />
          <ellipse cx="80" cy="115" rx="6" ry="4" fill="rgba(21,128,61,0.2)" />
        </>
      ) : (
        <path
          d="M62 112 Q80 126 98 112"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Thinking sweat drop + small bubbles */}
      {thinking && (
        <>
          <ellipse cx="114" cy="56" rx="5" ry="8" fill="rgba(147,197,253,0.85)"
            style={{ animation: "yaya-float 1.4s ease-in-out infinite" }}
          />
          <circle cx="122" cy="70" r="3" fill="rgba(147,197,253,0.6)"
            style={{ animation: "yaya-float 1.8s ease-in-out 0.3s infinite" }}
          />
          <circle cx="128" cy="60" r="2" fill="rgba(147,197,253,0.45)"
            style={{ animation: "sparkle 2s ease-in-out 0.6s infinite" }}
          />
        </>
      )}
      {/* Happy sparkles when speaking */}
      {speaking && (
        <>
          <text x="28" y="52" fontSize="10" fill="rgba(253,224,71,0.9)" style={{ animation: "sparkle 1s ease-out 0s infinite" }}>★</text>
          <text x="118" y="48" fontSize="8"  fill="rgba(167,243,208,0.9)" style={{ animation: "sparkle 1s ease-out 0.22s infinite" }}>✦</text>
          <text x="22" y="85" fontSize="7"  fill="rgba(253,186,116,0.85)" style={{ animation: "sparkle 1s ease-out 0.44s infinite" }}>✦</text>
          <text x="126" y="82" fontSize="9" fill="rgba(253,224,71,0.8)" style={{ animation: "sparkle 1s ease-out 0.66s infinite" }}>★</text>
        </>
      )}
    </svg>
  );
}

// ─── Ambient aura effects ───────────────────────────────────────────────────
function Aura({ state }: { state: VoiceState }) {
  if (state === "idle") {
    return (
      <div style={{
        position: "absolute", inset: -18, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(74,222,128,0.2) 0%, transparent 70%)",
        animation: "pulse-soft 3.2s ease-in-out infinite",
      }} />
    );
  }

  if (state === "listening") {
    return (
      <>
        {[0, 0.58, 1.16].map((delay, i) => (
          <div key={i} style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "2.5px solid rgba(74,222,128,0.75)",
            animation: `pulse-ring 2s ease-out ${delay}s infinite`,
          }} />
        ))}
      </>
    );
  }

  if (state === "thinking") {
    const colors = ["#4ade80", "#a3e635", "#34d399"];
    const glows  = ["rgba(74,222,128,0.8)", "rgba(163,230,53,0.8)", "rgba(52,211,153,0.8)"];
    return (
      <>
        {/* outer orbit */}
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute",
            left: "50%", top: "50%",
            marginLeft: -7, marginTop: -7,
            width: 14, height: 14, borderRadius: "50%",
            background: colors[i],
            boxShadow: `0 0 14px ${glows[i]}`,
            animation: `orbit 2.2s linear ${i * 0.73}s infinite`,
          }} />)
        )}
        {/* inner orbit (reverse) */}
        {["#86efac", "#fde68a"].map((c, i) => (
          <div key={"r" + i} style={{
            position: "absolute",
            left: "50%", top: "50%",
            marginLeft: -5, marginTop: -5,
            width: 10, height: 10, borderRadius: "50%",
            background: c,
            opacity: 0.75,
            animation: `orbit-rev 1.6s linear ${i * 0.8}s infinite`,
          }} />
        ))}
      </>
    );
  }

  if (state === "speaking") {
    return (
      <>
        {[0, 0.42, 0.84].map((delay, i) => (
          <div key={i} style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "2px solid rgba(74,222,128,0.55)",
            animation: `pulse-ring 1.4s ease-out ${delay}s infinite`,
          }} />
        ))}
      </>
    );
  }

  return null;
}

// ─── Audio wave bars (listening) ────────────────────────────────────────────
function AudioBars() {
  // varying widths for more organic look
  const widths = [4, 5, 7, 5, 8, 5, 4, 6, 4];
  const delays = [0, 0.08, 0.16, 0.06, 0.22, 0.12, 0.04, 0.18, 0.10];
  const durations = [0.48, 0.52, 0.44, 0.58, 0.42, 0.56, 0.50, 0.46, 0.54];
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", height: 52, marginTop: 6 }}>
      {widths.map((w, i) => (
        <div key={i} style={{
          width: w,
          height: 4,
          borderRadius: 4,
          background: i % 2 === 0
            ? "linear-gradient(to top, #4ade80, #a7f3d0)"
            : "linear-gradient(to top, #34d399, #6ee7b7)",
          boxShadow: "0 0 10px rgba(74,222,128,0.6)",
          animation: `wave-bar ${durations[i]}s ease-in-out ${delays[i]}s infinite`,
        }} />
      ))}
    </div>
  );
}

function SpeakBars() {
  const heights = [12, 20, 28, 20, 32, 24, 16, 24, 14];
  const delays  = [0, 0.07, 0.14, 0.05, 0.21, 0.11, 0.03, 0.17, 0.09];
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", height: 52, marginTop: 6 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 4,
          height: h,
          borderRadius: 4,
          background: "linear-gradient(to top, #16a34a, #86efac)",
          boxShadow: "0 0 8px rgba(22,163,74,0.5)",
          animation: `speak-wave 0.5s ease-in-out ${delays[i]}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Quick local response (non-agri queries) ────────────────────────────────

// ─── Chinese ASR homophone correction ───────────────────────────────────────
// 农业场景常见同音字/近音字误识别修正
const HOMOPHONE_FIXES: Array<[RegExp, string]> = [
  [/大蓬|大篷/g,           "大棚"],
  [/贯盖|灌盖|管盖|惯盖/g, "灌溉"],
  [/不光灯|布光灯|补框灯/g, "补光灯"],
  [/同封|通封|痛风/g,       "通风"],
  [/疯鸡|丰机|封机|风击/g,  "风机"],
  [/点击电机|点机|电击/g,   "电机"],
  [/彩收|菜收|采手/g,       "采收"],
  [/博种|薄种|拨种/g,       "播种"],
  [/是度|十度(?!以)/g,      "湿度"],
  [/温独|文度|纹度/g,       "温度"],
  [/师肥|是肥|失肥/g,       "施肥"],
  [/教水|浇谁|焦水/g,       "浇水"],
  [/光召|广照|光找/g,       "光照"],
  [/传感期|传感旗/g,        "传感器"],
  [/病冲害|病昆害/g,        "病虫害"],
];

function correctASR(text: string): string {
  let result = text;
  for (const [pattern, fix] of HOMOPHONE_FIXES) {
    result = result.replace(pattern, fix);
  }
  return result;
}

/** 对候选文本打分：分越高越可能是有效指令 */
function scoreCandidate(text: string): number {
  if (isRuleCreationIntent(text))     return 5;
  if (isSensorDataQuery(text))        return 4;
  if (parseNavigationCommand(text))   return 3;
  if (parseDeviceCommand(text))       return 3;
  if (isAgriQuery(text))              return 2;
  if (quickReply(text))               return 1;
  return 0;
}

const AGRI_KEYWORDS = [
  // 核心操作
  "灌溉", "施肥", "浇水", "施药", "除草", "修剪", "分枝", "播种", "种植", "采收", "收获",
  // 环境指标
  "温度", "湿度", "光照", "光强", "气温", "光合", "蒸腾", "补光",
  // 病虫害
  "病虫害", "病虫", "虫害", "摄氏", "百菌", "病害", "杂草", "枯萎", "黄叶", "燃焦", "渗水",
  // 温控
  "升温", "降温", "通风", "风机", "干旱", "缺水",
  // 设施/设备
  "传感器", "温室", "大棚", "土壤", "水分", "电机", "马达", "灯光",
  // 肥料/养分
  "营养", "肥料", "氮磷钾", "养分",
  // 生长周期
  "发芽", "开花", "结果", "生长", "长势", "成熟",
  // 作物类型（口语）
  "植物", "作物", "庄稼", "蔬菜", "水果", "花卉",
  // 管理/决策
  "异常", "预警", "报警", "决策", "建议", "检测", "监控", "数据", "分析",
];

function isAgriQuery(text: string): boolean {
  if (AGRI_KEYWORDS.some((kw) => text.includes(kw))) return true;
  // 口语化决策询问："需要浇水吗"、"该施肥了吗"、"要不要通风"
  if (/(需要|该|要不要|有没有必要|应该).*(浇|施|通|种|收|除|整|修|喷|换|补)/.test(text)) return true;
  // 怎么养/种/管护
  if (/(怎么|如何|怎样).*(养|种|管|护|防|治|施|浇|种)/.test(text)) return true;
  // 大棚/温室状态询问
  if (/(大棚|温室|温度|湿度|光照).*(怎么样|如何|正常吗|有问题|多少|几度)/.test(text)) return true;
  return false;
}

const GREETINGS: Record<string, string> = {
  "\u4f60\u597d": "\u4f60\u597d\uff01\u6211\u662f\u82bd\u82bd\uff0c\u4f60\u7684\u667a\u6167\u519c\u4e1a\u5c0f\u52a9\u624b\uff0c\u6709\u4ec0\u4e48\u519c\u4e8b\u95ee\u9898\u5c3d\u7ba1\u95ee\u6211\u54df\uff01",
  "\u65e9": "\u65e9\u5578\uff01\u65b0\u7684\u4e00\u5929\uff0c\u5e0c\u671b\u5927\u68da\u4eca\u5929\u751f\u673a\u52c3\u52c3\uff01\ud83c\udf31",
  "\u665a": "\u665a\u4e0a\u597d\uff01\u5929\u8272\u6697\u4e86\uff0c\u8bb0\u5f97\u68c0\u67e5\u4e00\u4e0b\u6e29\u5ba4\u6e29\u5ea6\u54e6~",
  "\u4e2d\u5348\u597d": "\u4e2d\u5348\u597d\uff01\u4eca\u5929\u5149\u7167\u5145\u8db3\uff0c\u662f\u5927\u68da\u751f\u957f\u7684\u597d\u65f6\u5019\uff01",
  "\u8c22\u8c22": "\u4e0d\u5ba2\u6c14\uff01\u6709\u4e0d\u61c2\u7684\u968f\u65f6\u95ee\u6211\u554a\ud83d\ude0a",
  "\u611f\u8c22": "\u4e0d\u5ba2\u6c14\uff01\u6709\u4e0d\u61c2\u7684\u968f\u65f6\u95ee\u6211\u554a\ud83d\ude0a",
  "\u4f60\u662f\u8c01": "\u6211\u662f\u82bd\u82bd\uff0c\u57fa\u4e8e LangGraph \u7684\u667a\u6167\u519c\u4e1a AI\uff01\u64c5\u957f\u704c\u6e89\u3001\u65bd\u8098\u3001\u5149\u7167\u3001\u75c5\u866b\u5bb3\u7b49\u51b3\u7b56\u5efa\u8bae\u3002",
  "\u4ecb\u7ecd": "\u6211\u662f\u82bd\u82bd\uff0c\u4e00\u4e2a\u53ef\u7231\u7684\u667a\u6167\u519c\u4e1a\u5c0f\u52a9\u624b\uff01\u6211\u53ef\u4ee5\u5206\u6790\u5c0f\u68da\u4f20\u611f\u5668\u6570\u636e\uff0c\u5e2e\u4f60\u505a\u51b3\u7b56\u3002",
  "\u6ca1\u6709": "\u5ca9\u5ca9\uff0c\u6ca1\u95ee\u9898\uff0c\u6709\u4e08\u5c31\u53eb\u6211\uff01\ud83c\udf31",
  "\u6211\u8981": "\u8bf4\u5427\uff01\u6211\u5728\u5462\ud83d\udc42",
  "\u80fd\u5e72\u4ec0\u4e48": "\u6211\u80fd\u5e2e\u4f60\u5206\u6790\u5927\u68da\u72b6\u51b5\uff0c\u7ed9\u51fa\u704c\u6e89\u3001\u65bd\u8098\u3001\u8865\u5149\u3001\u901a\u98ce\u7b49\u51b3\u7b56\u5efa\u8bae\uff0c\u8bd5\u8457\u95ee\u6211\u5427\uff01",
};

function quickReply(text: string): string | null {
  for (const [kw, reply] of Object.entries(GREETINGS)) {
    if (text.includes(kw)) return reply;
  }
  return null;
}

type DeviceCommand = {
  commandType: "LIGHT_CONTROL" | "MOTOR_CONTROL";
  action: "ON" | "OFF";
  label: string;
};

function parseDeviceCommand(text: string): DeviceCommand | null {
  const t = text.replace(/\s+/g, "");

  // 含时间段/条件词的不作为即时控制，应走规则创建路径
  if (/[\d一二两三四五六七八九十]+\s*[点时:：]/.test(t)) return null;
  if (/(每天|每日|定时|到|至)/.test(t) && /[点时:：]/.test(t)) return null;
  if (/(超过|高于|低于|大于|小于|达到|太热|太冷|太暗|太干|太湿)/.test(t)) return null;
  if (/(报警|告警|提醒|通知)/.test(t)) return null;

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

function buildEnvAdvice(snapshot: SensorSnapshot): string[] {
  const advice: string[] = [];
  const temp = snapshot.temperature;
  const humidity = snapshot.humidity;
  const light = snapshot.luminance;

  if (typeof temp === "number") {
    if (temp >= 32) {
      advice.push("温度偏高，建议优先通风降温并避免正午灌溉。");
    } else if (temp <= 15) {
      advice.push("温度偏低，建议夜间保温，减少大通风时长。");
    }
  }

  if (typeof humidity === "number") {
    if (humidity >= 85) {
      advice.push("湿度偏高，建议开启风机短时除湿，预防病害。");
    } else if (humidity <= 45) {
      advice.push("湿度偏低，建议小水量补灌并关注蒸腾过快问题。");
    }
  }

  if (typeof light === "number") {
    if (light <= 250) {
      advice.push("当前光照偏弱，建议按作物生长期补光。");
    }
  }

  return advice;
}

function mergeDecisionWithAdvice(decision: string, snapshot: SensorSnapshot): string {
  const advice = buildEnvAdvice(snapshot);
  if (advice.length === 0) {
    return decision;
  }
  return `${decision}\n\n【基于当前环境的补充建议】\n- ${advice.join("\n- ")}`;
}

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
  { to: "/decision", label: "智控决策", aliases: ["智控决策", "决策页面", "芽芽助手", "芽芽"] },
  { to: "/users", label: "用户管理", aliases: ["用户管理", "用户页面", "账号管理"] },
  { to: "/logs", label: "登录日志", aliases: ["登录日志", "日志页面", "用户日志"] },
];

function parseNavigationCommand(text: string): NavCommand | null {
  const t = text.replace(/\s+/g, "");
  const hasNavVerb = /(打开|进入|跳到|跳转到|切到|切换到|去|前往|到|显示|看看|看一下|查看)/.test(t);

  for (const item of NAV_COMMANDS) {
    if (item.aliases.some((alias) => t.includes(alias))) {
      // 有导航动词、或包含页面关键词、或句子较短且不含疑问词
      if (hasNavVerb || /页面|界面|大屏/.test(t) || (t.length <= 12 && !/多少|是否|怎么|如何|几度|吗/.test(t))) {
        return { to: item.to, label: item.label };
      }
    }
  }

  return null;
}

// ─── Sensor data direct-query detection ─────────────────────────────────────

/** 匹配"查询当前传感器数值"意图，应直接报数而非给决策建议 */
function isSensorDataQuery(text: string): boolean {
  const t = text.replace(/\s+/g, "");
  if (/(温度|湿度|光照|光强|气温).*(是多少|多少|几度|怎么样|如何|多高|多低|正常吗|高不高|低不低|呢|了)/.test(t)) return true;
  if (/多少度|几度了|几度啊|多少度了/.test(t)) return true;  // "现在多少度" 不含具体指标词
  if (/(当前|现在|最新|目前).*(温度|湿度|光照|传感|数据|大棚|环境|状态)/.test(t)) return true;
  if (/(传感器|大棚|环境|温室).*(数据|状态|情况|参数|读数|是多少|怎么样|如何|怎么了|正常吗|有没有问题)/.test(t)) return true;
  if (/(看看|查看|显示|告诉我|汇报|报告).*(数据|温度|湿度|光照|传感|大棚|情况|状态)/.test(t)) return true;
  if (/(设备|风机|风扇|补光灯).*(状态|情况|开了吗|关了吗|是开的|是关的|怎么样)/.test(t)) return true;
  if (/(有没有|是否).*(异常|问题|报警|告警)/.test(t)) return true;
  if (/大棚(怎么样|怎样|如何|好吗|正常吗|没事吧|情况)/.test(t)) return true;
  return false;
}

/** 从快照提取一行传感器摘要，用于在决策建议前播报当前数值 */
function buildSensorSummary(snapshot: SensorSnapshot): string {
  if (!snapshot || snapshot.reportTime === null) return "";
  const parts: string[] = [];
  if (snapshot.temperature != null) parts.push(`温度${snapshot.temperature.toFixed(1)}℃`);
  if (snapshot.humidity    != null) parts.push(`湿度${snapshot.humidity.toFixed(1)}%`);
  if (snapshot.luminance   != null) parts.push(`光照${Math.round(snapshot.luminance)}lux`);
  if (parts.length === 0) return "";
  return `当前大棚：${parts.join("，")}。`;
}

/** 将传感器快照格式化为直接口语化答复 */
function formatSensorDirectAnswer(snapshot: SensorSnapshot): string {
  if (!snapshot || snapshot.reportTime === null) {
    return "当前暂无传感器数据，请确认设备已正常连接并上传数据。";
  }
  const temp  = snapshot.temperature != null ? `${snapshot.temperature.toFixed(1)}℃`   : "暂无";
  const humi  = snapshot.humidity    != null ? `${snapshot.humidity.toFixed(1)}%`      : "暂无";
  const light = snapshot.luminance   != null ? `${Math.round(snapshot.luminance)} lux` : "暂无";
  const led   = snapshot.ledStatus   ?? "未知";
  const motor = snapshot.motorStatus ?? "未知";
  return `当前大棚温度${temp}，湿度${humi}，光照强度${light}。` +
    `补光灯${led}，风机${motor}。已为你切换到总览大屏。`;
}

// ─── Intent normalization ────────────────────────────────────────────────────

type TopicTag = "SENSOR" | "IRRIGATION" | "LIGHT" | "MOTOR" | "PEST" | "FERTILIZE" | "HARVEST" | "GENERAL";

interface NormalizeResult {
  text: string;          // 规范化后的文本，用于路由和后端
  topicTag: TopicTag;    // 本轮话题标签，供下轮上下文参考
  displayHint?: string;  // 展示给用户看的"芽芽理解为：xxx"
}

/**
 * 将模糊的口语表达映射为场景化的标准意图描述。
 * lastTopic: 上一轮话题，用于处理"再看一下"等指代。
 */
function normalizeIntent(raw: string, lastTopic: TopicTag | null): NormalizeResult {
  const t = raw.replace(/\s+/g, "");

  // ── 0. 规则创建意图直接原样返回，不做归一化 ──
  // 避免把"打开下午2点到4点的补光灯"归一化成"分析光照需求"
  if (isRuleCreationIntent(t)) {
    const tag: TopicTag =
      /(灯|补光|光照)/.test(t) ? "LIGHT" :
      /(风机|电机|通风)/.test(t) ? "MOTOR" : "GENERAL";
    return { text: raw, topicTag: tag };
  }

  // ── 1. 纯状态查询（无具体指标）──
  if (/^(帮我)?(看看|瞧瞧|查查|看一下|查一下|了解一下|汇报)(一下|下|下情况)?$/.test(t) ||
      /^(现在|当前|目前)(怎么样|咋样|如何|情况)?$/.test(t) ||
      /^大棚(怎么样|咋样|如何|情况|好吗|正常吗|没事吧)?$/.test(t) ||
      /^(有没有|有啥|有什么)(问题|异常|情况)$/.test(t)) {
    return { text: "当前大棚传感器数据是什么", topicTag: "SENSOR",
             displayHint: "查看大棚当前传感器数据" };
  }

  // ── 2. 指代上一轮话题（再/还/继续/另外） ──
  if (/(再|还|继续|另外)(看看|查查|问问|说说|看一下|查一下)/.test(t) && lastTopic) {
    const topicMap: Record<TopicTag, string> = {
      SENSOR:    "大棚当前传感器数据",
      IRRIGATION:"当前是否需要灌溉",
      LIGHT:     "当前光照情况及补光建议",
      MOTOR:     "当前通风状态",
      PEST:      "当前病虫害防治建议",
      FERTILIZE: "当前施肥建议",
      HARVEST:   "当前采收时机建议",
      GENERAL:   raw,
    };
    return { text: topicMap[lastTopic], topicTag: lastTopic,
             displayHint: `继续查看：${topicMap[lastTopic]}` };
  }

  // ── 3. 灌溉类 ──
  if (/(需要|该|要不要|有没有必要|应该)(浇水|灌溉|补水)/.test(t) ||
      /浇水(吗|呢|嘛|没有)?$/.test(t) ||
      /(水分|土壤水分|缺水)(怎么样|如何|多少|正常吗)/.test(t)) {
    return { text: "当前土壤水分状态如何，是否需要灌溉，给出具体建议", topicTag: "IRRIGATION",
             displayHint: "分析灌溉需求" };
  }

  // ── 4. 光照/补光类 ──
  if (/(需要|该|要不要)(开灯|补光|开补光灯|打开灯)/.test(t) ||
      /(补光灯|光照)(要|需要|应该|怎么)(开|关|调|处理)/.test(t) ||
      /光照(够吗|足吗|弱吗|强吗|正常吗|怎么样)/.test(t)) {
    return { text: "当前光照强度是否足够，是否需要开启补光灯", topicTag: "LIGHT",
             displayHint: "分析光照与补光需求" };
  }

  // ── 5. 通风/降温类 ──
  if (/(需要|该|要不要)(通风|开风机|散热|降温|开电机)/.test(t) ||
      /(风机|电机|通风)(要|需要|应该|怎么)(开|关|处理)/.test(t) ||
      /温度(太高|太热|偏高|高吗|正常吗|降一下)/.test(t)) {
    return { text: "当前温度和通风状态如何，是否需要开启风机降温", topicTag: "MOTOR",
             displayHint: "分析通风降温需求" };
  }

  // ── 6. 病虫害类 ──
  if (/(有没有|是否|有)(病虫害|虫害|病害|虫子|病了)/.test(t) ||
      /(植物|作物|蔬菜)(有没有|是否)(问题|异常|病了|不对)/.test(t) ||
      /病虫害(怎么|如何)(防|治|处理|预防)/.test(t)) {
    return { text: "当前大棚是否存在病虫害风险，给出防治建议", topicTag: "PEST",
             displayHint: "分析病虫害防治" };
  }

  // ── 7. 施肥类 ──
  if (/(需要|该|要不要)(施肥|施氮|补肥|追肥|施药)/.test(t) ||
      /施肥(了吗|了没|一下|建议|计划)/.test(t)) {
    return { text: "当前作物营养状况如何，是否需要施肥，给出施肥建议", topicTag: "FERTILIZE",
             displayHint: "分析施肥需求" };
  }

  // ── 8. 采收类 ──
  if (/(可以|能|该|要)(采收|收了|收获|摘了|摘下来)/.test(t) ||
      /采收(时间|时机|了吗|了没|建议)/.test(t)) {
    return { text: "当前作物是否达到采收标准，给出采收时机建议", topicTag: "HARVEST",
             displayHint: "分析采收时机" };
  }

  // ── 9. 模糊动作（弄/搞/处理 + 模糊对象） ──
  if (/(弄一下|搞一下|处理一下|整一下)(.*)?/.test(t)) {
    const obj = t.replace(/(弄一下|搞一下|处理一下|整一下)/, "").trim();
    if (obj) {
      return { text: `${obj}相关的处理建议`, topicTag: "GENERAL",
               displayHint: `处理"${obj}"` };
    }
    // 完全没有对象，fallback 到传感器
    return { text: "当前大棚传感器数据是什么", topicTag: "SENSOR",
             displayHint: "查看大棚当前状态" };
  }

  // ── 10. 无法归类：原样返回，但尝试推断 topicTag ──
  const tag: TopicTag =
    /(灌溉|浇水|水分)/.test(t) ? "IRRIGATION" :
    /(光照|补光|灯)/.test(t)   ? "LIGHT" :
    /(通风|风机|降温|电机)/.test(t) ? "MOTOR" :
    /(病虫|虫害|病害)/.test(t) ? "PEST" :
    /(施肥|肥料|营养)/.test(t) ? "FERTILIZE" :
    /(采收|收获)/.test(t)      ? "HARVEST" :
    /(温度|湿度|传感|大棚|数据)/.test(t) ? "SENSOR" : "GENERAL";

  return { text: raw, topicTag: tag };
}

// ─── Main component ─────────────────────────────────────────────────────────
export function SmartDecision() {
  const [vs, setVS]           = useState<VoiceState>("idle");
  const [userText, setUserText] = useState("");
  const [aiText,   setAiText]   = useState("");
  const [normalizedHint, setNormalizedHint] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  /** 芽芽的思考过程 — 逐步推入每一步推理，让用户看到 AI 的思路链 */
  const [thoughts, setThoughts] = useState<
    Array<{ id: number; label: string; detail?: string; kind: "step" | "result" }>
  >([]);
  const thoughtIdRef = useRef(0);
  const pushThought = useCallback(
    (label: string, detail?: string, kind: "step" | "result" = "step") => {
      thoughtIdRef.current += 1;
      setThoughts((prev) => [
        ...prev,
        { id: thoughtIdRef.current, label, detail, kind },
      ]);
    },
    [],
  );
  const navigate = useNavigate();

  const vsRef       = useRef<VoiceState>("idle");
  const recRef      = useRef<ISpeechRecognition | null>(null);
  const lastTopicRef = useRef<TopicTag | null>(null);
  const deviceIdRef = useRef("69d75b1d7f2e6c302f654fea_20031104");

  // Unified state setter that keeps the ref in sync
  const go = useCallback((s: VoiceState) => {
    vsRef.current = s;
    setVS(s);
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
    return () => {
      recRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakText = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) { go("idle"); return; }
    synth.cancel();

    // ── Voice selection: prioritise Microsoft Xiaoxiao/Xiaoyi (most human-like on Windows) ──
    const pickVoice = (voices: SpeechSynthesisVoice[]) => {
      const zh = voices.filter((v) => v.lang.startsWith("zh"));
      return (
        zh.find((v) => /xiaoxiao/i.test(v.name))                          ??  // Microsoft Xiaoxiao – best
        zh.find((v) => /xiaoyi|xiaoyan|huihui/i.test(v.name))             ??  // Other MS voices
        zh.find((v) => /google.*zh|zh.*google/i.test(v.name))             ??  // Google TTS
        zh.find((v) => !/male|yunxi|yunyang|yunjian/i.test(v.name))       ??  // any non-male
        zh[0]
      );
    };

    // ── Clean markdown/symbols that TTS would read aloud literally ──
    const clean = text
      .replace(/\*\*(.+?)\*\*/g, "$1")          // bold
      .replace(/\*(.+?)\*/g,   "$1")            // italic
      .replace(/#+\s*/g,       "")              // headings
      .replace(/`[^`]+`/g,     "")              // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links
      .replace(/[>\-\*•◆◇→]/g, "")             // bullets / arrows
      .replace(/\n{2,}/g, "\u3002")             // blank lines → period
      .replace(/\n/g, "\uff0c")                 // single newline → comma
      .trim();

    // ── Cap length: first 180 chars, cut at last sentence boundary ──
    const capped = clean.length > 180
      ? clean.slice(0, 180).replace(/[^。！？…，、]+$/, "") || clean.slice(0, 180)
      : clean;

    // ── Split into sentences for natural breathing rhythm ──
    const sentences = capped
      .split(/(?<=[。！？…\n])/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length === 0) { go("idle"); return; }

    // ── Queue sentences one-by-one; each transition = natural pause ──
    const speakQueue = (voice: SpeechSynthesisVoice | undefined, queue: string[]) => {
      if (queue.length === 0 || vsRef.current !== "speaking") { go("idle"); return; }
      const [head, ...rest] = queue;
      const utt = new SpeechSynthesisUtterance(head);
      utt.lang   = "zh-CN";
      utt.rate   = 1.05;   // natural conversational pace
      utt.pitch  = 1.08;   // slightly raised = female-friendly, warm tone
      utt.volume = 1;
      if (voice) utt.voice = voice;
      utt.onend   = () => speakQueue(voice, rest);
      utt.onerror = () => go("idle");
      synth.speak(utt);
    };

    const start = (voices: SpeechSynthesisVoice[]) => speakQueue(pickVoice(voices), sentences);

    const voices = synth.getVoices();
    if (voices.length > 0) {
      start(voices);
    } else {
      synth.onvoiceschanged = () => {
        start(synth.getVoices());
        synth.onvoiceschanged = null;
      };
      setTimeout(() => { if (!synth.speaking) speakQueue(undefined, sentences); }, 250);
    }
  }, [go, vsRef]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const rec = new SR();
    rec.lang             = "zh-CN";
    rec.continuous       = true;    // keep listening until user clicks stop
    rec.interimResults   = true;    // show real-time interim transcript
    rec.maxAlternatives  = 3;
    recRef.current       = rec;

    let finalTranscript  = "";       // accumulated final results
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    const SILENCE_MS = 2200;         // auto-stop after 2.2s of silence

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        // User stopped talking for 2.2s → commit
        rec.stop();
      }, SILENCE_MS);
    };

    rec.onresult = async (e: ISpeechRecognitionEvent) => {
      // Gather all results (some may be final, some interim)
      let interimText = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        const best = Array.from({ length: result.length }, (_, j) => ({
          transcript: correctASR(result[j].transcript),
          confidence: result[j].confidence ?? 1,
        })).reduce((prev, curr) => {
          const ps = scoreCandidate(prev.transcript);
          const cs = scoreCandidate(curr.transcript);
          if (cs > ps) return curr;
          if (cs === ps && curr.confidence > prev.confidence) return curr;
          return prev;
        });

        if ((result as unknown as { isFinal: boolean }).isFinal) {
          finalTranscript += best.transcript;
        } else {
          interimText += best.transcript;
        }
      }

      // Show live transcript to user
      const display = finalTranscript + interimText;
      if (display) setUserText(display);

      // Reset silence timer on every speech event
      resetSilenceTimer();
    };

    rec.onerror = (ev: Event) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      const errType = (ev as unknown as { error?: string }).error;
      // "no-speech" is normal — user just didn't say anything
      if (errType === "no-speech" || errType === "aborted") {
        go("idle");
        return;
      }
      go("idle");
    };

    rec.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (vsRef.current !== "listening") return;

      const text = finalTranscript.trim();
      if (!text) {
        // No speech detected at all → back to idle silently (no "没听清")
        go("idle");
        return;
      }

      // Process the accumulated transcript
      processVoiceInput(text);
    };

    go("listening");
    setUserText("");
    setAiText("");
    setNormalizedHint(null);
    setThoughts([]);
    try { rec.start(); resetSilenceTimer(); } catch { go("idle"); }
  }, [go, navigate, speakText]);

  /** Process the finalized voice transcript through all routing paths */
  const processVoiceInput = useCallback(async (text: string) => {
      setUserText(text);
      setAiText("");
      setNormalizedHint(null);
      setThoughts([]);
      go("thinking");
      pushThought("收到语音", `“${text}”`);

      // ── Semantic normalization: map vague speech to canonical intent ──
      const norm = normalizeIntent(text, lastTopicRef.current);
      const query = norm.text;          // use normalized text for all routing below
      if (norm.displayHint && norm.text !== text) {
        setNormalizedHint(norm.displayHint);
        pushThought("语义规范化", norm.displayHint);
      }

      // DEBUG: log routing decision
      const ruleText = isRuleCreationIntent(text);
      const ruleQuery = isRuleCreationIntent(query);
      console.log("[VoiceRoute] text:", JSON.stringify(text), "query:", JSON.stringify(query),
        "isRule(text):", ruleText, "isRule(query):", ruleQuery,
        "nav:", !!parseNavigationCommand(query));

      // ── Voice navigation path: jump to requested page ──
      const nav = parseNavigationCommand(query);
      if (nav) {
        pushThought("意图识别", "页面导航");
        pushThought("跳转路由", `${nav.label} (${nav.to})`, "result");
        navigate(nav.to);
        const reply = `好的，已为你打开${nav.label}页面。`;
        setAiText(reply);
        go("speaking");
        speakText(reply);
        return;
      }

      // ── Rule query path: "有哪些定时规则" / "看下告警规则" ──
      const ruleQueryKind = parseRuleQueryIntent(query) ?? parseRuleQueryIntent(text);
      if (ruleQueryKind) {
        pushThought("意图识别", `规则查询 (${ruleQueryKind})`);
        try {
          const summary = await fetchRulesSummary(ruleQueryKind, deviceIdRef.current);
          const total = summary.schedules.length + summary.linkages.length + summary.thresholds.length;
          pushThought("拉取后端规则", `共 ${total} 条`, "result");
          setAiText(summary.summary);
          go("speaking");
          // 语音只说总结,完整列表在字幕里
          const speakLine = total === 0
            ? "你还没有创建任何规则呢。"
            : `一共有 ${total} 条规则，详情请看屏幕。`;
          speakText(speakLine);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "未知错误";
          pushThought("查询失败", msg, "result");
          const reply = `抱歉，获取规则列表失败：${msg}`;
          setAiText(reply);
          go("speaking");
          speakText(reply);
        }
        return;
      }

      // ── Voice rule creation path (HIGHEST PRIORITY after nav) ──
      // 规则创建必须在设备控制之前判断，否则"打开下午2点到4点补光灯"会被误判为"立即开灯"
      if (isRuleCreationIntent(query) || isRuleCreationIntent(text)) {
        pushThought("意图识别", "规则创建");
        try {
          // 优先用原始text（避免normalizeIntent把时间词丢了），回退用query
          const ruleInput = isRuleCreationIntent(text) ? text : query;
          pushThought("解析并调用后端", "local parser → LLM fallback");
          const result = await parseAndCreateRule(ruleInput, deviceIdRef.current);
          const typeLabel =
            result.ruleType === "SCHEDULE" ? "定时规则" :
            result.ruleType === "LINKAGE"  ? "联动规则" : "阈值告警";
          const navTarget =
            result.ruleType === "SCHEDULE" ? "/control" :
            result.ruleType === "LINKAGE"  ? "/automation" : "/alerts";
          // 区分"取消"和"创建"语境(parser 在 schedule 类型下会用"取消"开头表达取消意图)
          const isCancel = /^取消/.test(result.explanation);
          const verb = isCancel ? "取消" : "创建";
          pushThought(`已${verb} ${typeLabel}`, result.explanation, "result");
          const reply = isCancel
            ? `好的，已为你${result.explanation}。`
            : `好的，已为你创建${typeLabel}：${result.explanation}。规则已启用，你可以在对应页面查看和管理。`;
          setAiText(reply);
          go("speaking");
          setTimeout(() => navigate(navTarget), 1500);
          speakText(reply);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "未知错误";
          pushThought("规则创建失败", msg, "result");
          const reply = `抱歉，规则创建失败：${msg}。请再试一次或用更明确的表达。`;
          setAiText(reply);
          go("speaking");
          speakText(reply);
        }
        return;
      }

      // ── Device control path: immediate device on/off (no time range) ──
      const cmd = parseDeviceCommand(query);
      if (cmd) {
        pushThought("意图识别", "设备控制");
        pushThought("发送指令", `${cmd.label} → ${cmd.action}`);
        try {
          const result = await sendManualControl({
            deviceId: deviceIdRef.current,
            commandType: cmd.commandType,
            action: cmd.action,
          });
          const actionText = cmd.action === "ON" ? "开启" : "关闭";
          pushThought("云端响应", `status=${result.status}`, "result");
          const reply = `${cmd.label}${actionText}指令已发送。状态：${result.status}。`;
          setAiText(reply);
          go("speaking");
          speakText(reply);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "未知错误";
          pushThought("控制失败", msg, "result");
          const reply = `抱歉，${cmd.label}控制失败：${msg}`;
          setAiText(reply);
          go("speaking");
          speakText(reply);
        }
        return;
      }

      // ── Fast path: local quick reply for casual conversation ──
      const quick = quickReply(query);
      if (quick) {
        pushThought("意图识别", "寒暄快捷回复", "result");
        setAiText(quick);
        go("speaking");
        speakText(quick);
        return;
      }

      // ── Sensor direct-read path (must come BEFORE !isAgriQuery so "多少度" etc. are caught) ──
      if (isSensorDataQuery(query)) {
        pushThought("意图识别", "传感器直读");
        try {
          pushThought("读取实时快照", "/api/v1/smart-decision/decide");
          const res = await executeDecision({ query, deviceId: deviceIdRef.current });
          const snap = res.sensorSnapshot;
          pushThought(
            "传感器数据",
            [
              snap.temperature != null ? `温度 ${snap.temperature}°C` : null,
              snap.humidity != null ? `湿度 ${snap.humidity}%` : null,
              snap.luminance != null ? `光照 ${snap.luminance}lx` : null,
            ].filter(Boolean).join(" · ") || "无数据",
            "result",
          );
          const answer = formatSensorDirectAnswer(res.sensorSnapshot);
          setAiText(answer);
          lastTopicRef.current = "SENSOR";
          go("speaking");
          navigate("/");
          speakText(answer);
        } catch {
          pushThought("读取失败", "后端服务异常", "result");
          const errMsg = "抱歉，获取传感器数据失败，请稍后再试。";
          setAiText(errMsg);
          go("speaking");
          speakText(errMsg);
        }
        return;
      }

      // ── Casual path: non-agri query → streaming LLM quick reply ──
      if (!isAgriQuery(query)) {
        pushThought("意图识别", "闲聊 / 非农事问题");
        pushThought("调用 Agri-Agent LLM", "流式回复");
        let accumulated = "";
        try {
          await streamAgriAgentChat(
            { question: query },
            {
              onToken: (token) => { accumulated += token; },
              onDone: () => {},
              onError: (msg) => { throw new Error(msg); },
            },
          );
          const reply = accumulated.trim() ||
            "我暂时还不太懂这个问题，但有农事问题尽管问我！";
          pushThought("生成完成", `${reply.length} 字`, "result");
          setAiText(reply);
          go("speaking");
          speakText(reply);
        } catch {
          pushThought("LLM 异常", "回退本地回复", "result");
          const fallback = "我暂时还不太懂这个问题，但灌溉、施肥、光照等农事问题我擅长！";
          setAiText(fallback);
          go("speaking");
          speakText(fallback);
        }
        return;
      }

      // ── Agri decision path: call backend smart decision, prefix with live sensor data ──
      pushThought("意图识别", "农事智能决策");
      pushThought("调用 LangGraph 工作流", "classify_intent → 场景节点");
      try {
        const res = await executeDecision({ query, deviceId: deviceIdRef.current });
        const snap = res.sensorSnapshot;
        const sensorLine = [
          snap.temperature != null ? `温 ${snap.temperature}°C` : null,
          snap.humidity != null ? `湿 ${snap.humidity}%` : null,
          snap.luminance != null ? `光 ${snap.luminance}lx` : null,
        ].filter(Boolean).join(" · ");
        if (sensorLine) pushThought("传感器快照", sensorLine);
        if (res.scenarioLabel) {
          pushThought(
            "场景命中",
            `${res.scenarioLabel}${res.graphTrace ? ` · ${res.graphTrace}` : ""}`,
            "result",
          );
        }
        const sensorPrefix = buildSensorSummary(res.sensorSnapshot);
        const enhanced = mergeDecisionWithAdvice(res.decision, res.sensorSnapshot);
        const fullReply = sensorPrefix ? `${sensorPrefix}\n\n${enhanced}` : enhanced;
        lastTopicRef.current = norm.topicTag;
        setAiText(fullReply);
        go("speaking");
        speakText(fullReply);
      } catch {
        pushThought("后端异常", "LangGraph 执行失败", "result");
        const errMsg = "抱歉，我遇到了一些问题，请稍后再试一次";
        setAiText(errMsg);
        go("speaking");
        speakText(errMsg);
      }
  }, [go, navigate, speakText, pushThought]);

  const handleMic = useCallback(() => {
    const state = vsRef.current;
    if (state === "idle") {
      window.speechSynthesis?.cancel();
      startListening();
    } else if (state === "listening") {
      recRef.current?.stop();
    } else if (state === "speaking") {
      window.speechSynthesis?.cancel();
      go("idle");
    }
    // thinking: ignore
  }, [go, startListening]);

  // Button appearance
  const micBg =
    vs === "listening" ? "#ef4444" :
    vs === "speaking"  ? "#f59e0b" :
    "linear-gradient(135deg, #4ade80, #16a34a)";

  const micShadow =
    vs === "listening" ? "rgba(239,68,68,0.55)" :
    vs === "speaking"  ? "rgba(245,158,11,0.55)" :
    "rgba(22,163,74,0.55)";

  const btnLabel =
    vs === "idle"      ? "\u70b9\u51fb\u5f00\u59cb\u8bf4\u8bdd" :
    vs === "listening" ? "\u8bc6\u522b\u4e2d\uff0c\u518d\u6b21\u70b9\u51fb\u505c\u6b62" :
    vs === "thinking"  ? "\u601d\u8003\u4e2d\u2026" :
    "\u70b9\u51fb\u6253\u65ad\u64ad\u653e";

  return (
    <div
      style={{
        height: "100%",
        minHeight: 600,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #071407 0%, #0c2410 55%, #071407 100%)",
        borderRadius: 16,
        position: "relative",
        overflow: "hidden",
        padding: "32px 24px 40px",
        gap: 0,
        userSelect: "none",
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Ambient background glow */}
      <div style={{
        position: "absolute",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 65%)",
        top: "42%", left: "50%",
        transform: "translate(-50%, -55%)",
        pointerEvents: "none",
      }} />

      {/* Character + aura */}
      <div style={{
        position: "relative",
        width: 250, height: 250,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Aura state={vs} />
        <YayaAvatar state={vs} />
      </div>

      {/* Status text */}
      <p style={{
        marginTop: 18,
        fontSize: 20,
        fontWeight: 700,
        color: "#4ade80",
        letterSpacing: "0.04em",
        textAlign: "center",
        textShadow: "0 0 22px rgba(74,222,128,0.45)",
      }}>
        {STATUS[vs]}
      </p>

      {/* Listening audio bars */}
      {vs === "listening" && <AudioBars />}
      {vs === "speaking"  && <SpeakBars />}

      {/* Subtitle area */}
      <div style={{
        height: 84,
        marginTop: vs === "listening" ? 2 : 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0 36px",
        textAlign: "center",
      }}>
        {userText && (
          <p style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            maxWidth: 500,
            lineHeight: 1.55,
            animation: "sub-in 0.4s ease",
          }}>
            &ldquo;{userText}&rdquo;
          </p>
        )}
        {normalizedHint && vs !== "idle" && (
          <p style={{
            fontSize: 12,
            color: "rgba(74,222,128,0.55)",
            maxWidth: 500,
            lineHeight: 1.4,
            animation: "sub-in 0.3s ease",
          }}>
            芽芽理解为：{normalizedHint}
          </p>
        )}
        {aiText && vs !== "idle" && (
          <p style={{
            fontSize: 13,
            color: "rgba(134,239,172,0.85)",
            maxWidth: 500,
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            animation: "sub-in 0.4s ease",
          } as React.CSSProperties}>
            {aiText}
          </p>
        )}
      </div>

      {/* 芽芽思考过程 — chain-of-thought 可视化 */}
      {thoughts.length > 0 && vs !== "idle" && (
        <div style={{
          width: "min(560px, 92%)",
          marginTop: 4,
          marginBottom: 4,
          padding: "10px 14px",
          borderRadius: 14,
          background: "rgba(15, 23, 42, 0.55)",
          border: "1px solid rgba(74,222,128,0.25)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          backdropFilter: "blur(8px)",
          animation: "sub-in 0.35s ease",
          zIndex: 2,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(134,239,172,0.85)",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 8px #4ade80",
              animation: vs === "thinking" ? "pulse-soft 1.2s ease-in-out infinite" : "none",
            }} />
            芽芽思考过程
            <span style={{ marginLeft: "auto", opacity: 0.55, fontSize: 10 }}>
              {thoughts.length} 步
            </span>
          </div>
          <ol style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxHeight: 140,
            overflowY: "auto",
          }}>
            {thoughts.map((t, i) => {
              const isResult = t.kind === "result";
              return (
                <li key={t.id} style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: isResult ? "#bbf7d0" : "rgba(226,232,240,0.82)",
                  animation: "sub-in 0.3s ease",
                }}>
                  <span style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: isResult
                      ? "linear-gradient(135deg,#4ade80,#16a34a)"
                      : "rgba(74,222,128,0.18)",
                    color: isResult ? "#052e16" : "#86efac",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}>
                    {isResult ? "✓" : i + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{t.label}</span>
                    {t.detail && (
                      <span style={{
                        marginLeft: 6,
                        opacity: 0.7,
                        fontSize: 11,
                      }}>
                        — {t.detail}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Mic / stop button */}
      <button
        onClick={handleMic}
        disabled={vs === "thinking"}
        aria-label={btnLabel}
        style={{
          marginTop: 10,
          width: 80,
          height: 80,
          borderRadius: "50%",
          border: "none",
          cursor: vs === "thinking" ? "not-allowed" : "pointer",
          background: micBg,
          boxShadow: `0 6px 30px ${micShadow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transform: vs === "listening" ? "scale(1.22)" : "scale(1)",
          zIndex: 2,
        }}
      >
        {vs === "thinking" ? (
          <div style={{
            width: 28, height: 28,
            border: "3px solid rgba(255,255,255,0.35)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin-btn 0.78s linear infinite",
          }} />
        ) : vs === "speaking" ? (
          <Square style={{ width: 27, height: 27, fill: "#fff", color: "#fff" }} />
        ) : (
          <Mic style={{ width: 32, height: 32, color: "#fff" }} />
        )}
      </button>

      {/* Button hint */}
      <p style={{
        marginTop: 13,
        fontSize: 12,
        color: "rgba(255,255,255,0.38)",
        letterSpacing: "0.04em",
      }}>
        {btnLabel}
      </p>

      {/* Unsupported warning */}
      {!supported && (
        <div style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 12,
          color: "#f87171",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          padding: "6px 16px",
          borderRadius: 8,
          whiteSpace: "nowrap",
        }}>
          {"\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u8bed\u97f3\u8bc6\u522b API"}
        </div>
      )}
    </div>
  );
}
