/**
 * YayaPet — floating draggable pet widget that can be embedded in any page.
 * Clicking it opens/closes an inline voice-control overlay.
 * Does NOT share state with SmartDecision page; uses same logic independently.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, X, MessageCircle } from "lucide-react";
import { executeDecision } from "../services/smartDecision";
import { streamAgriAgentChat } from "../services/agriAgent";

// ─── Web Speech API types (same as SmartDecision.tsx) ─────────────────────
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
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export type PetState = "idle" | "listening" | "thinking" | "speaking";

const AGRI_KEYWORDS = [
  "\u704c\u6e89","\u65bd\u8098","\u6e29\u5ea6","\u6e7f\u5ea6","\u5149\u7167","\u5149\u5f3a","\u8865\u5149",
  "\u75c5\u866b\u5bb3","\u75c5\u866b","\u866b\u5bb3","\u6444\u6c0f","\u767e\u83cc",
  "\u91c7\u6536","\u6536\u6536","\u5347\u6e29","\u964d\u6e29","\u901a\u98ce","\u98ce\u673a",
  "\u4f20\u611f\u5668","\u6e29\u5ba4","\u5927\u68da","\u571f\u58e4","\u6c34\u5206",
  "\u8425\u517b","\u80a5\u6599","\u6c2e\u78f7\u9492","\u5206\u679d","\u4fee\u526a",
  "\u79cd\u690d","\u64ad\u79cd","\u53d1\u82bd","\u5f00\u82b1","\u7ed3\u679c",
  "\u75c5\u5bb3","\u6742\u8349","\u67af\u840e","\u9ec4\u53f6","\u71c3\u7126","\u6e0d\u6c34",
  "\u5f02\u5e38","\u9884\u8b66","\u62a5\u8b66","\u51b3\u7b56","\u5efa\u8bae",
  "\u68c0\u6d4b","\u76d1\u63a7","\u6570\u636e","\u5206\u6790",
];
function isAgriQuery(t: string) { return AGRI_KEYWORDS.some((k) => t.includes(k)); }

const GREETINGS: Record<string, string> = {
  "\u4f60\u597d": "\u4f60\u597d\uff01\u6211\u662f\u82bd\u82bd\uff0c\u6709\u4ec0\u4e48\u519c\u4e8b\u95ee\u9898\u5c3d\u7ba1\u95ee\u6211\u54e6\uff01",
  "\u65e9": "\u65e9\u5578\uff01\u5e0c\u671b\u5927\u68da\u4eca\u5929\u751f\u673a\u52c3\u52c3\uff01\ud83c\udf31",
  "\u665a": "\u665a\u4e0a\u597d\uff01\u8bb0\u5f97\u68c0\u67e5\u4e00\u4e0b\u6e29\u5ba4\u6e29\u5ea6\u54e6~",
  "\u8c22\u8c22": "\u4e0d\u5ba2\u6c14\uff01\u6709\u4e0d\u61c2\u7684\u968f\u65f6\u95ee\u6211\uff01",
  "\u611f\u8c22": "\u4e0d\u5ba2\u6c14\uff01\u6709\u4e0d\u61c2\u7684\u968f\u65f6\u95ee\u6211\uff01",
  "\u4f60\u662f\u8c01": "\u6211\u662f\u82bd\u82bd\uff0c\u4f60\u7684\u667a\u6167\u519c\u4e1a AI\uff01",
};
function quickReply(t: string) {
  for (const [k, r] of Object.entries(GREETINGS)) { if (t.includes(k)) return r; }
  return null;
}

// ─── Yaya SVG (same face, smaller) ────────────────────────────────────────
export function YayaFace({ state, size = 68 }: { state: PetState; size?: number }) {
  const thinking = state === "thinking";
  const speaking = state === "speaking";
  const listening = state === "listening";
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none"
      style={{
        animation:
          state === "idle" ? "pet-float 3.8s ease-in-out infinite" :
          speaking       ? "pet-bob 0.4s ease-in-out infinite" :
          thinking       ? "pet-sway 2s ease-in-out infinite" : "none",
        filter: "drop-shadow(0 6px 18px rgba(34,197,94,0.55))",
        display: "block",
      }}
    >
      <defs>
        <radialGradient id="pf-face" cx="38%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="pf-leaf" cx="28%" cy="20%" r="72%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#4ade80" />
        </radialGradient>
      </defs>
      <ellipse cx="57" cy="34" rx="22" ry="30" fill="url(#pf-leaf)" opacity="0.95" transform="rotate(-28 57 34)" />
      <ellipse cx="103" cy="32" rx="22" ry="30" fill="url(#pf-leaf)" opacity="0.85" transform="rotate(28 103 32)" />
      <rect x="77" y="42" width="6" height="26" rx="3" fill="#86efac" />
      <circle cx="80" cy="100" r="54" fill="url(#pf-face)" />
      <ellipse cx="62" cy="76" rx="18" ry="11" fill="rgba(255,255,255,0.14)" transform="rotate(-30 62 76)" />
      <ellipse cx="46" cy="108" rx="13" ry="8" fill="rgba(253,164,175,0.48)" />
      <ellipse cx="114" cy="108" rx="13" ry="8" fill="rgba(253,164,175,0.48)" />
      {thinking ? (
        <>
          <path d="M55 87 Q66 80 77 87" stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M83 87 Q94 80 105 87" stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="66" cy="86" rx={listening ? 11 : 9} ry={listening ? 13 : 10} fill="rgba(255,255,255,0.92)"
            style={state === "idle" ? { animation: "pet-blink 4s ease-in-out infinite", transformBox: "fill-box" as React.CSSProperties["transformBox"], transformOrigin: "center" } as React.CSSProperties : {}} />
          <ellipse cx="94" cy="86" rx={listening ? 11 : 9} ry={listening ? 13 : 10} fill="rgba(255,255,255,0.92)"
            style={state === "idle" ? { animation: "pet-blink 4s ease-in-out 0.06s infinite", transformBox: "fill-box" as React.CSSProperties["transformBox"], transformOrigin: "center" } as React.CSSProperties : {}} />
          <circle cx="67" cy="88" r={listening ? 6.5 : 5.2} fill="#15803d" />
          <circle cx="95" cy="88" r={listening ? 6.5 : 5.2} fill="#15803d" />
          <circle cx="69.5" cy="85.5" r="2.2" fill="rgba(255,255,255,0.88)" />
          <circle cx="97.5" cy="85.5" r="2.2" fill="rgba(255,255,255,0.88)" />
        </>
      )}
      {speaking ? (
        <ellipse cx="80" cy="114" rx="12" ry="8" fill="rgba(255,255,255,0.92)"
          style={{ animation: "pet-mouth 0.28s cubic-bezier(0.4,0,0.6,1) infinite", transformBox: "fill-box" as React.CSSProperties["transformBox"], transformOrigin: "center" } as React.CSSProperties} />
      ) : listening ? (
        <ellipse cx="80" cy="113" rx="10" ry="8" fill="rgba(255,255,255,0.88)" />
      ) : (
        <path d="M62 112 Q80 126 98 112" stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

// ─── Pet Panel (voice interaction drawer) ──────────────────────────────────
const PANEL_KEYFRAMES = `
@keyframes pet-float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
@keyframes pet-bob   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.03)} }
@keyframes pet-sway  { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg) translateY(-3px)} }
@keyframes pet-blink { 0%,90%,100%{transform:scaleY(1)} 94%{transform:scaleY(0.05)} }
@keyframes pet-mouth { 0%{transform:scaleY(0.3) scaleX(0.9)} 40%{transform:scaleY(1.7) scaleX(1.1)} 100%{transform:scaleY(0.3)} }
@keyframes pet-pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.15);opacity:0.8} }
@keyframes pet-ring  { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.8);opacity:0} }
@keyframes pet-wave  { 0%,100%{height:4px;opacity:0.6} 50%{height:36px;opacity:1} }
@keyframes pet-orbit { 0%{transform:rotate(0deg) translateX(38px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(38px) rotate(-360deg)} }
@keyframes pet-slide-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes pet-bounce-in { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
`;

export function YayaPet() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PetState>("idle");
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const stateRef = useRef<PetState>("idle");
  const recRef = useRef<ISpeechRecognition | null>(null);

  const go = useCallback((s: PetState) => { stateRef.current = s; setState(s); }, []);

  useEffect(() => () => { recRef.current?.abort(); window.speechSynthesis?.cancel(); }, []);

  // ── TTS ──
  const speak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) { go("idle"); return; }
    synth.cancel();
    const pickVoice = (vs: SpeechSynthesisVoice[]) => {
      const zh = vs.filter((v) => v.lang.startsWith("zh"));
      return zh.find((v) => /xiaoxiao/i.test(v.name)) ?? zh.find((v) => !/male|yunxi/i.test(v.name)) ?? zh[0];
    };
    const clean = text.replace(/\*\*(.+?)\*\*/g,"$1").replace(/#+\s*/g,"").replace(/\n/g,"，").trim();
    const capped = clean.length > 180 ? clean.slice(0,180).replace(/[^。！？]+$/,"") : clean;
    const sentences = capped.split(/(?<=[。！？…])/).map(s=>s.trim()).filter(Boolean);
    if (!sentences.length) { go("idle"); return; }
    const queue = (v: SpeechSynthesisVoice | undefined, q: string[]) => {
      if (!q.length || stateRef.current !== "speaking") { go("idle"); return; }
      const utt = new SpeechSynthesisUtterance(q[0]);
      utt.lang = "zh-CN"; utt.rate = 1.05; utt.pitch = 1.08; utt.volume = 1;
      if (v) utt.voice = v;
      utt.onend = () => queue(v, q.slice(1));
      utt.onerror = () => go("idle");
      synth.speak(utt);
    };
    const start = (vs: SpeechSynthesisVoice[]) => queue(pickVoice(vs), sentences);
    const vs = synth.getVoices();
    if (vs.length) start(vs);
    else { synth.onvoiceschanged = () => { start(synth.getVoices()); synth.onvoiceschanged = null; }; setTimeout(()=>{ if(!synth.speaking) queue(undefined, sentences); },250); }
  }, [go]);

  // ── Voice recognition ──
  const startListen = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN"; rec.continuous = false; rec.interimResults = false;
    recRef.current = rec;

    rec.onresult = async (e: ISpeechRecognitionEvent) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join("");
      setUserText(text); setAiText(""); go("thinking");
      const quick = quickReply(text);
      if (quick) { setAiText(quick); go("speaking"); speak(quick); return; }
      if (!isAgriQuery(text)) {
        let acc = "";
        try {
          await streamAgriAgentChat({ question: text }, { onToken: t => { acc += t; }, onDone: ()=>{}, onError: msg=>{ throw new Error(msg); } });
          const reply = acc.trim() || "\u6211\u6682\u65f6\u8fd8\u4e0d\u592a\u61c2\uff0c\u4f46\u6709\u519c\u4e8b\u95ee\u9898\u5c3d\u7ba1\u95ee\u6211\uff01";
          setAiText(reply); go("speaking"); speak(reply);
        } catch {
          const fb = "\u6211\u6682\u65f6\u8fd8\u4e0d\u592a\u61c2\uff0c\u4f46\u706c\u6e89\u3001\u65bd\u8098\u7b49\u519c\u4e8b\u95ee\u9898\u6211\u64c5\u957f\uff01";
          setAiText(fb); go("speaking"); speak(fb);
        }
        return;
      }
      try {
        const res = await executeDecision({ query: text });
        setAiText(res.decision); go("speaking"); speak(res.decision);
      } catch {
        const err = "\u62b1\u6b49\uff0c\u6211\u9047\u5230\u4e86\u95ee\u9898\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5";
        setAiText(err); go("speaking"); speak(err);
      }
    };
    rec.onerror = () => go("idle");
    rec.onend = () => { if (stateRef.current === "listening") go("thinking"); };
    go("listening"); setUserText(""); setAiText("");
    try { rec.start(); } catch { go("idle"); }
  }, [go, speak]);

  const handleMic = useCallback(() => {
    const s = stateRef.current;
    if (s === "idle") { window.speechSynthesis?.cancel(); startListen(); }
    else if (s === "listening") recRef.current?.stop();
    else if (s === "speaking") { window.speechSynthesis?.cancel(); go("idle"); }
  }, [go, startListen]);

  // Aura indicator dots
  const micColor = state === "listening" ? "#ef4444" : state === "speaking" ? "#f59e0b" : "#4ade80";

  return (
    <>
      <style>{PANEL_KEYFRAMES}</style>

      {/* Floating pet button */}
      <div
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 1000,
          cursor: "pointer",
          animation: "pet-bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
        onClick={() => { if (!open) { setOpen(true); } }}
        title={open ? "" : "\u82bd\u82bd\u5c0f\u52a9\u624b"}
      >
        {/* Aura */}
        {!open && (
          <>
            <div style={{ position:"absolute",inset:-8,borderRadius:"50%", background:"radial-gradient(circle,rgba(74,222,128,0.25) 0%,transparent 70%)", animation:"pet-pulse 3s ease-in-out infinite" }} />
            {state === "speaking" && [0,0.5,1].map(d=>(
              <div key={d} style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(74,222,128,0.6)", animation:`pet-ring 1.4s ease-out ${d}s infinite` }} />
            ))}
          </>
        )}
        <div style={{ position:"relative", width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#166534,#15803d)", boxShadow:`0 4px 20px rgba(21,128,61,0.5)`, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
          <YayaFace state={state} size={68} />
        </div>
        {/* Status dot */}
        <div style={{ position:"absolute", bottom:2, right:2, width:14, height:14, borderRadius:"50%", background:micColor, border:"2px solid #fff", boxShadow:`0 0 6px ${micColor}` }} />
        {/* Thinking orbits */}
        {state === "thinking" && [0,1,2].map(i=>(
          <div key={i} style={{ position:"absolute",left:"50%",top:"50%",marginLeft:-5,marginTop:-5,width:10,height:10,borderRadius:"50%",background:["#4ade80","#a3e635","#34d399"][i],animation:`pet-orbit 2s linear ${i*0.67}s infinite` }} />
        ))}
      </div>

      {/* Panel overlay */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: 110,
          right: 28,
          width: 320,
          zIndex: 1001,
          borderRadius: 20,
          background: "linear-gradient(160deg,#071407 0%,#0c2410 60%,#071407 100%)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(74,222,128,0.2)",
          padding: "20px 18px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          animation: "pet-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
          userSelect: "none",
        }}>
          {/* Close */}
          <button onClick={()=>setOpen(false)} style={{ position:"absolute",top:10,right:10,background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,padding:"3px 6px",cursor:"pointer",color:"rgba(255,255,255,0.5)" }}>
            <X style={{width:14,height:14}} />
          </button>

          {/* Character */}
          <div style={{ position:"relative",width:110,height:110,display:"flex",alignItems:"center",justifyContent:"center" }}>
            {/* Aura ring */}
            {state === "listening" && [0,0.6,1.2].map(d=>(
              <div key={d} style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(74,222,128,0.7)",animation:`pet-ring 2s ease-out ${d}s infinite` }} />
            ))}
            {state === "thinking" && [0,1,2].map(i=>(
              <div key={i} style={{ position:"absolute",left:"50%",top:"50%",marginLeft:-6,marginTop:-6,width:12,height:12,borderRadius:"50%",background:["#4ade80","#a3e635","#34d399"][i],boxShadow:`0 0 10px rgba(74,222,128,0.8)`,animation:`pet-orbit 2.2s linear ${i*0.73}s infinite` }} />
            ))}
            <YayaFace state={state} size={100} />
          </div>

          {/* Name + status */}
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:16,fontWeight:700,color:"#4ade80",margin:0,textShadow:"0 0 16px rgba(74,222,128,0.5)" }}>
              {"\u82bd\u82bd"}
            </p>
            <p style={{ fontSize:12,color:state==="idle"?"rgba(255,255,255,0.4)":"#86efac",margin:"3px 0 0",transition:"color 0.3s" }}>
              {state==="idle" ? "\u70b9\u51fb\u9ea6\u514b\u5f00\u59cb\u5bf9\u8bdd" :
               state==="listening" ? "\u6211\u5728\u8ba4\u771f\u542c\u2026" :
               state==="thinking" ? "\u8ba9\u6211\u60f3\u4e00\u60f3\u2026" : "\u82bd\u82bd\u8bf4\uff1a"}
            </p>
          </div>

          {/* Audio bars */}
          {state === "listening" && (
            <div style={{ display:"flex",gap:4,alignItems:"center",height:36 }}>
              {[4,6,9,6,10,7,5,7,4].map((w,i)=>(
                <div key={i} style={{ width:w,height:4,borderRadius:3,background:"linear-gradient(to top,#4ade80,#a7f3d0)",boxShadow:"0 0 8px rgba(74,222,128,0.55)",animation:`pet-wave 0.${48+i*2}s ease-in-out ${i*0.07}s infinite` }} />
              ))}
            </div>
          )}

          {/* Subtitle */}
          {(userText || aiText) && (
            <div style={{ width:"100%",borderRadius:12,background:"rgba(255,255,255,0.06)",padding:"10px 12px",maxHeight:80,overflowY:"auto" }}>
              {userText && <p style={{ fontSize:12,color:"rgba(255,255,255,0.55)",margin:"0 0 4px",lineHeight:1.5 }}>&ldquo;{userText}&rdquo;</p>}
              {aiText && state!=="idle" && <p style={{ fontSize:12,color:"rgba(134,239,172,0.85)",margin:0,lineHeight:1.5 }}>{aiText.slice(0,120)}{aiText.length>120?"…":""}</p>}
            </div>
          )}

          {/* Mic button */}
          <button
            onClick={handleMic}
            disabled={state === "thinking"}
            style={{
              width:54,height:54,borderRadius:"50%",border:"none",
              cursor: state==="thinking" ? "not-allowed" : "pointer",
              background: state==="listening" ? "#ef4444" : state==="speaking" ? "#f59e0b" : "linear-gradient(135deg,#4ade80,#16a34a)",
              boxShadow: `0 4px 20px ${state==="listening"?"rgba(239,68,68,0.5)":state==="speaking"?"rgba(245,158,11,0.5)":"rgba(22,163,74,0.5)"}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              transform: state==="listening" ? "scale(1.18)" : "scale(1)",
              transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {state==="thinking" ? (
              <div style={{ width:20,height:20,border:"3px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"pet-orbit 0.8s linear infinite" }} />
            ) : state==="speaking" ? (
              <Square style={{width:20,height:20,fill:"#fff",color:"#fff"}} />
            ) : (
              <Mic style={{width:22,height:22,color:"#fff"}} />
            )}
          </button>

          {/* Navigate hint */}
          <div style={{ display:"flex",gap:6,alignItems:"center",opacity:0.5 }}>
            <MessageCircle style={{width:11,height:11,color:"#86efac"}} />
            <span style={{ fontSize:10,color:"#86efac" }}>{"\u82bd\u82bd\u53ef\u4ee5\u8fdb\u884c\u667a\u80fd\u51b3\u7b56\u548c\u65e5\u5e38\u5bf9\u8bdd"}</span>
          </div>
        </div>
      )}
    </>
  );
}
