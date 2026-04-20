import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { useNavigate } from "react-router";
import { executeDecision, type SensorSnapshot } from "../services/smartDecision";
import { streamAgriAgentChat } from "../services/agriAgent";
import { sendManualControl } from "../services/deviceControl";

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

const AGRI_KEYWORDS = [
  "\u704c\u6e89", "\u65bd\u8098", "\u6e29\u5ea6", "\u6e7f\u5ea6", "\u5149\u7167", "\u5149\u5f3a", "\u8865\u5149",
  "\u75c5\u866b\u5bb3", "\u75c5\u866b", "\u866b\u5bb3", "\u6444\u6c0f", "\u767e\u83cc",
  "\u91c7\u6536", "\u6536\u6536", "\u5347\u6e29", "\u964d\u6e29", "\u901a\u98ce", "\u98ce\u673a",
  "\u4f20\u611f\u5668", "\u6e29\u5ba4", "\u5927\u68da", "\u571f\u58e4", "\u6c34\u5206",
  "\u8425\u517b", "\u80a5\u6599", "\u6c2e\u78f7\u9492", "\u5206\u679d", "\u4fee\u526a",
  "\u79cd\u690d", "\u64ad\u79cd", "\u53d1\u82bd", "\u5f00\u82b1", "\u7ed3\u679c",
  "\u75c5\u5bb3", "\u6742\u8349", "\u67af\u840e", "\u9ec4\u53f6", "\u71c3\u7126", "\u6e0d\u6c34",
  "\u5f02\u5e38", "\u9884\u8b66", "\u62a5\u8b66", "\u51b3\u7b56", "\u5efa\u8bae",
  "\u68c0\u6d4b", "\u76d1\u63a7", "\u6570\u636e", "\u5206\u6790",
];

function isAgriQuery(text: string): boolean {
  return AGRI_KEYWORDS.some((kw) => text.includes(kw));
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

// ─── Main component ─────────────────────────────────────────────────────────
export function SmartDecision() {
  const [vs, setVS]           = useState<VoiceState>("idle");
  const [userText, setUserText] = useState("");
  const [aiText,   setAiText]   = useState("");
  const [supported, setSupported] = useState(true);
  const navigate = useNavigate();

  const vsRef  = useRef<VoiceState>("idle");
  const recRef = useRef<ISpeechRecognition | null>(null);
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
    rec.lang           = "zh-CN";
    rec.continuous     = false;
    rec.interimResults = false;
    recRef.current     = rec;

    rec.onresult = async (e: ISpeechRecognitionEvent) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setUserText(text);
      setAiText("");
      go("thinking");

      // ── Voice navigation path: jump to requested page ──
      const nav = parseNavigationCommand(text);
      if (nav) {
        navigate(nav.to);
        const reply = `好的，已为你打开${nav.label}页面。`;
        setAiText(reply);
        go("speaking");
        speakText(reply);
        return;
      }

      // ── Device control path: keep existing features and expand control ability ──
      const cmd = parseDeviceCommand(text);
      if (cmd) {
        try {
          const result = await sendManualControl({
            deviceId: deviceIdRef.current,
            commandType: cmd.commandType,
            action: cmd.action,
          });
          const actionText = cmd.action === "ON" ? "开启" : "关闭";
          const reply = `${cmd.label}${actionText}指令已发送。状态：${result.status}。`;
          setAiText(reply);
          go("speaking");
          speakText(reply);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "未知错误";
          const reply = `抱歉，${cmd.label}控制失败：${msg}`;
          setAiText(reply);
          go("speaking");
          speakText(reply);
        }
        return;
      }

      // ── Fast path: local quick reply for casual conversation ──
      const quick = quickReply(text);
      if (quick) {
        setAiText(quick);
        go("speaking");
        speakText(quick);
        return;
      }

      // ── Casual path: non-agri query → streaming LLM quick reply ──
      if (!isAgriQuery(text)) {
        let accumulated = "";
        try {
          await streamAgriAgentChat(
            { question: text },
            {
              onToken: (token) => { accumulated += token; },
              onDone: () => {},
              onError: (msg) => { throw new Error(msg); },
            },
          );
          const reply = accumulated.trim() ||
            "\u6211\u6682\u65f6\u8fd8\u4e0d\u592a\u61c2\u8fd9\u4e2a\u95ee\u9898\uff0c\u4f46\u6709\u519c\u4e8b\u95ee\u9898\u5c3d\u7ba1\u95ee\u6211\uff01";
          setAiText(reply);
          go("speaking");
          speakText(reply);
        } catch {
          const fallback = "\u6211\u6682\u65f6\u8fd8\u4e0d\u592a\u61c2\u8fd9\u4e2a\u95ee\u9898\uff0c\u4f46\u706c\u6e89\u3001\u65bd\u8098\u3001\u5149\u7167\u7b49\u519c\u4e8b\u95ee\u9898\u6211\u64c5\u957f\uff01";
          setAiText(fallback);
          go("speaking");
          speakText(fallback);
        }
        return;
      }

      // ── Agri path: call backend smart decision ──
      try {
        const res = await executeDecision({ query: text, deviceId: deviceIdRef.current });
        const enhanced = mergeDecisionWithAdvice(res.decision, res.sensorSnapshot);
        setAiText(enhanced);
        go("speaking");
        speakText(enhanced);
      } catch {
        const errMsg =
          "\u62b1\u6b49\uff0c\u6211\u9047\u5230\u4e86\u4e00\u4e9b\u95ee\u9898\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u4e00\u6b21";
        setAiText(errMsg);
        go("speaking");
        speakText(errMsg);
      }
    };

    rec.onerror = () => go("idle");

    rec.onend = () => {
      if (vsRef.current === "listening") go("thinking");
    };

    go("listening");
    setUserText("");
    setAiText("");
    try { rec.start(); } catch { go("idle"); }
  }, [go, navigate, speakText]);

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
