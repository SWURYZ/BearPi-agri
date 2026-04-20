import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { executeDecision } from "../services/smartDecision";

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
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-14px); }
}
@keyframes yaya-bob {
  0%, 100% { transform: translateY(0px) scale(1); }
  50%      { transform: translateY(-5px) scale(1.025); }
}
@keyframes yaya-mouth {
  from { transform: scaleY(0.35); }
  to   { transform: scaleY(1.65); }
}
@keyframes pulse-ring {
  0%   { transform: scale(1);   opacity: 0.85; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes pulse-soft {
  0%, 100% { transform: scale(1);    opacity: 0.35; }
  50%      { transform: scale(1.08); opacity: 0.75; }
}
@keyframes orbit {
  0%   { transform: rotate(0deg)   translateX(108px) rotate(0deg); }
  100% { transform: rotate(360deg) translateX(108px) rotate(-360deg); }
}
@keyframes wave-bar {
  from { height: 4px; }
  to   { height: 38px; }
}
@keyframes spin-btn {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes sub-in {
  from { opacity: 0; transform: translateY(7px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes thinking-dot {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
  40%           { transform: scale(1.1); opacity: 1;   }
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
            ? "yaya-float 3.6s ease-in-out infinite"
            : speaking
            ? "yaya-bob 0.42s ease-in-out infinite"
            : "none",
        filter: "drop-shadow(0 14px 36px rgba(34,197,94,0.5))",
        zIndex: 1,
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
          <path d="M57 84 Q66 79 75 84"  stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M85 84 Q94 79 103 84" stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="66" cy="86" rx={eyeW} ry={eyeH} fill="rgba(255,255,255,0.92)" />
          <ellipse cx="94" cy="86" rx={eyeW} ry={eyeH} fill="rgba(255,255,255,0.92)" />
          <circle  cx="67" cy="88" r={listening ? 6 : 5}  fill="#15803d" />
          <circle  cx="95" cy="88" r={listening ? 6 : 5}  fill="#15803d" />
          <circle  cx="69.5" cy="85.5" r="2" fill="rgba(255,255,255,0.85)" />
          <circle  cx="97.5" cy="85.5" r="2" fill="rgba(255,255,255,0.85)" />
        </>
      )}

      {/* Mouth */}
      {speaking ? (
        <ellipse
          cx="80" cy="113" rx="11" ry="7"
          fill="rgba(255,255,255,0.9)"
          style={{
            animation: "yaya-mouth 0.32s ease-in-out infinite alternate",
            transformBox: "fill-box" as React.CSSProperties["transformBox"],
            transformOrigin: "center",
          } as React.CSSProperties}
        />
      ) : listening ? (
        <ellipse cx="80" cy="113" rx="9" ry="7" fill="rgba(255,255,255,0.85)" />
      ) : (
        <path
          d="M64 112 Q80 124 96 112"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Thinking sweat drop */}
      {thinking && (
        <ellipse
          cx="112" cy="58" rx="5" ry="8"
          fill="rgba(147,197,253,0.85)"
          style={{ animation: "yaya-float 1.6s ease-in-out infinite" }}
        />
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
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute",
            left: "50%", top: "50%",
            marginLeft: -7, marginTop: -7,
            width: 14, height: 14, borderRadius: "50%",
            background: colors[i],
            boxShadow: `0 0 12px ${glows[i]}`,
            animation: `orbit 2.2s linear ${i * 0.73}s infinite`,
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
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", height: 48, marginTop: 8 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{
          width: 5, height: 4, borderRadius: 3,
          background: "linear-gradient(to top, #4ade80, #a7f3d0)",
          boxShadow: "0 0 8px rgba(74,222,128,0.55)",
          animation: `wave-bar 0.54s ease-in-out ${i * 0.075}s infinite alternate`,
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

// ─── Main component ─────────────────────────────────────────────────────────
export function SmartDecision() {
  const [vs, setVS]           = useState<VoiceState>("idle");
  const [userText, setUserText] = useState("");
  const [aiText,   setAiText]   = useState("");
  const [supported, setSupported] = useState(true);

  const vsRef  = useRef<VoiceState>("idle");
  const recRef = useRef<ISpeechRecognition | null>(null);

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

    const doSpeak = (voice?: SpeechSynthesisVoice) => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang  = "zh-CN";
      utt.rate  = 0.9;
      utt.pitch = 1.12;
      if (voice) utt.voice = voice;
      utt.onend  = () => go("idle");
      utt.onerror = () => go("idle");
      synth.speak(utt);
    };

    const voices = synth.getVoices();
    if (voices.length > 0) {
      doSpeak(voices.find((v) => v.lang.startsWith("zh")));
    } else {
      // voices may not be loaded yet on first call
      synth.onvoiceschanged = () => {
        doSpeak(synth.getVoices().find((v) => v.lang.startsWith("zh")));
      };
      // fallback: speak after a tick without specifying voice
      setTimeout(() => { if (!synth.speaking) doSpeak(); }, 400);
    }
  }, [go]);

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

      // ── Fast path: local quick reply for casual conversation ──
      const quick = quickReply(text);
      if (quick) {
        setAiText(quick);
        go("speaking");
        speakText(quick);
        return;
      }

      // ── Agri path: non-agri query without keywords → quick default reply ──
      if (!isAgriQuery(text)) {
        const fallback =
          "\u8fd9\u4e2a\u95ee\u9898\u6211\u6682\u65f6\u8fd8\u4e0d\u592a\u61c2\uff0c\u4f46\u706c\u6e89\u3001\u65bd\u8098\u3001\u5149\u7167\u3001\u75c5\u866b\u5bb3\u7b49\u519c\u4e8b\u95ee\u9898\u6211\u64c5\u957f\uff0c\u6362\u4e2a\u8bd5\u8bd5\u5427\uff01";
        setAiText(fallback);
        go("speaking");
        speakText(fallback);
        return;
      }

      // ── Slow path: call backend smart decision ──
      try {
        const res = await executeDecision({ query: text });
        setAiText(res.decision);
        go("speaking");
        speakText(res.decision);
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
  }, [go, speakText]);

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
