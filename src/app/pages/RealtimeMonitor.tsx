import { useEffect, useState } from "react";
import { Activity, Wifi, ChevronLeft } from "lucide-react";
import {
  SENSOR_KEYS,
  type SensorKey,
  connectRealtimeStream,
  fetchRealtimeSnapshot,
} from "../services/realtime";
import { fetchAllConnectedDevices } from "../services/greenhouseMonitor";
import { fetchRealtimeDeviceStatus } from "../services/deviceControl";
import { GreenhouseDigitalTwin } from "../components/GreenhouseDigitalTwin";

const GREENHOUSE_LIST = ["1号大棚", "2号大棚", "3号大棚", "4号大棚", "5号大棚", "6号大棚"];

const GREENHOUSE_CROPS: Record<string, string> = {
  "1号大棚": "番茄", "2号大棚": "黄瓜", "3号大棚": "草莓",
  "4号大棚": "辣椒", "5号大棚": "生菜", "6号大棚": "茄子",
};

// Crop colors [fruit, leaf] for mini card plants
const CROP_COLORS: Record<string, [string, string]> = {
  "番茄": ["#ef4444", "#16a34a"], "黄瓜": ["#84cc16", "#15803d"],
  "草莓": ["#e11d48", "#22c55e"], "辣椒": ["#dc2626", "#15803d"],
  "生菜": ["#4ade80", "#166534"], "茄子": ["#9333ea", "#16a34a"],
};

type ConnectionMode = "live" | "waiting" | "offline";

const ONLINE_GREENHOUSE = "1号大棚";

const emptySensorValues: Partial<Record<SensorKey, number>> = SENSOR_KEYS.reduce(
  (acc, k) => { acc[k] = undefined; return acc; },
  {} as Partial<Record<SensorKey, number>>,
);

function toClockTime(input: Date) {
  return input.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Mini greenhouse card for overview ───────────────────────────────────────
interface MiniGHProps {
  name: string; crop: string;
  connectionMode: ConnectionMode;
  sensorValues: Partial<Record<SensorKey, number>>;
  ledOn: boolean; motorOn: boolean;
  onClick: () => void;
}
function MiniGH({ name, crop, connectionMode, sensorValues: sv, ledOn, motorOn, onClick }: MiniGHProps) {
  const borderColor = connectionMode === "live" ? "#22c55e"
    : connectionMode === "waiting" ? "#3b82f6" : "#475569";
  const [fr, lf] = CROP_COLORS[crop] ?? ["#ef4444", "#16a34a"];
  const connText = connectionMode === "live" ? "实时" : connectionMode === "waiting" ? "等待" : "离线";
  const connTextColor = connectionMode === "live" ? "#86efac"
    : connectionMode === "waiting" ? "#93c5fd" : "#94a3b8";
  const isTomato = crop === "\u756a\u8304";

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:scale-[1.025] group relative"
      style={{
        background: "linear-gradient(160deg,#060d1a 0%,#0f1e35 100%)",
        border: `1.5px solid ${borderColor}35`,
        boxShadow: `0 2px 16px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ boxShadow: `inset 0 0 0 1.5px ${borderColor}80` }} />

      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${borderColor}20` }}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: borderColor, boxShadow: `0 0 5px ${borderColor}` }} />
          <span className="text-xs font-bold text-gray-200">{name}</span>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: `${borderColor}18`, color: connTextColor, border: `1px solid ${borderColor}35` }}>
          {connText}
        </span>
      </div>

      {/* SVG greenhouse */}
      {isTomato ? (
        /* ── 3-D oblique greenhouse — tomato ─────────────────────────── */
        <svg viewBox="0 0 280 175" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ height: 140 }}>
          <defs>
            <filter id="mgh-glow-f">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* sky fill */}
          <path d="M40,92 Q108,18 177,92 L200,78 Q131,4 63,78 Z"
            fill={connectionMode !== "offline" ? "rgba(14,40,90,0.4)" : "rgba(8,16,35,0.35)"} />
          {/* back arch wire */}
          <path d="M63,78 Q131,4 200,78"
            fill="none" stroke={borderColor} strokeWidth="1.1" opacity="0.55" />
          <line x1="63" y1="78" x2="63" y2="148" stroke={borderColor} strokeWidth="0.8" opacity="0.35" />
          <line x1="200" y1="78" x2="200" y2="148" stroke={borderColor} strokeWidth="0.8" opacity="0.35" />
          <line x1="63" y1="148" x2="200" y2="148" stroke={borderColor} strokeWidth="0.8" opacity="0.25" />
          {/* floor */}
          <polygon points="40,162 177,162 200,148 63,148" fill="#122808" opacity="0.7" />
          {/* soil front row */}
          <polygon points="48,160 169,160 191,147 70,147" fill="#3a1a06" />
          {/* soil back row */}
          <polygon points="56,147 165,147 183,137 75,137" fill="#2e1404" />
          {/* LED glow fill */}
          {ledOn && <ellipse cx="118" cy="108" rx="75" ry="30" fill="rgba(253,230,138,0.10)" />}
          {/* back-row tomato plants */}
          {[78, 114, 150].map((px, i) => {
            const py = 143 + i;
            return (
              <g key={`b${i}`}>
                <line x1={px} y1={py} x2={px} y2={py - 28} stroke="#15803d" strokeWidth="1.1" />
                <line x1={px} y1={py - 8}  x2={px - 8}  y2={py - 16} stroke="#15803d" strokeWidth="0.85" />
                <line x1={px} y1={py - 8}  x2={px + 8}  y2={py - 16} stroke="#15803d" strokeWidth="0.85" />
                <line x1={px} y1={py - 18} x2={px - 6}  y2={py - 25} stroke="#15803d" strokeWidth="0.85" />
                <line x1={px} y1={py - 18} x2={px + 6}  y2={py - 25} stroke="#15803d" strokeWidth="0.85" />
                <circle cx={px - 9}  cy={py - 18} r={3.8} fill="#ef4444" opacity={0.92} />
                <circle cx={px + 9}  cy={py - 18} r={3.8} fill="#dc2626" opacity={0.92} />
                <circle cx={px - 7}  cy={py - 10} r={3.4} fill="#ef4444" opacity={0.88} />
                <circle cx={px + 7}  cy={py - 10} r={3.4} fill="#ef4444" opacity={0.88} />
                <circle cx={px}      cy={py - 30} r={3.4} fill="#f87171" opacity={0.94} />
                <ellipse cx={px - 10} cy={py - 20} rx="4" ry="2.2" fill="#166534" opacity={0.78}
                  transform={`rotate(-34,${px - 10},${py - 20})`} />
                <ellipse cx={px + 10} cy={py - 20} rx="4" ry="2.2" fill="#166534" opacity={0.78}
                  transform={`rotate(34,${px + 10},${py - 20})`} />
              </g>
            );
          })}
          {/* front-row tomato plants */}
          {[65, 108, 151].map((px, i) => {
            const py = 157;
            return (
              <g key={`f${i}`}>
                <line x1={px} y1={py} x2={px} y2={py - 35} stroke="#16a34a" strokeWidth="1.3" />
                <line x1={px} y1={py - 10} x2={px - 11} y2={py - 20} stroke="#16a34a" strokeWidth="0.95" />
                <line x1={px} y1={py - 10} x2={px + 11} y2={py - 20} stroke="#16a34a" strokeWidth="0.95" />
                <line x1={px} y1={py - 22} x2={px - 9}  y2={py - 30} stroke="#16a34a" strokeWidth="0.95" />
                <line x1={px} y1={py - 22} x2={px + 9}  y2={py - 30} stroke="#16a34a" strokeWidth="0.95" />
                <circle cx={px - 12} cy={py - 22} r={4.8} fill="#ef4444" opacity={0.95} />
                <circle cx={px + 12} cy={py - 22} r={4.8} fill="#dc2626" opacity={0.95} />
                <circle cx={px - 10} cy={py - 12} r={4.3} fill="#ef4444" opacity={0.92} />
                <circle cx={px + 10} cy={py - 12} r={4.3} fill="#ef4444" opacity={0.92} />
                <circle cx={px}      cy={py - 37} r={4.3} fill="#f87171" opacity={0.97} />
                <circle cx={px - 13.5} cy={py - 24.5} r={1.4} fill="rgba(255,255,255,0.38)" />
                <circle cx={px + 11}   cy={py - 24}   r={1.4} fill="rgba(255,255,255,0.38)" />
                <ellipse cx={px - 13} cy={py - 24} rx="4.8" ry="2.7" fill="#15803d" opacity={0.83}
                  transform={`rotate(-35,${px - 13},${py - 24})`} />
                <ellipse cx={px + 13} cy={py - 24} rx="4.8" ry="2.7" fill="#15803d" opacity={0.83}
                  transform={`rotate(35,${px + 13},${py - 24})`} />
                <ellipse cx={px} cy={py - 37} rx="3.8" ry="2.2" fill="#15803d" opacity={0.78}
                  transform={`rotate(-8,${px},${py - 37})`} />
              </g>
            );
          })}
          {/* drip irrigation */}
          <line x1="50" y1="157" x2="169" y2="157" stroke="#3b82f6" strokeWidth="1.1" opacity="0.45" />
          <line x1="58" y1="145" x2="163" y2="145" stroke="#3b82f6" strokeWidth="0.9" opacity="0.38" />
          {[65, 108, 151].map(x => <circle key={x} cx={x} cy={157} r={1.4} fill="#93c5fd" opacity={0.65} />)}
          {[78, 114, 150].map(x => <circle key={x} cx={x} cy={145} r={1.2} fill="#93c5fd" opacity={0.55} />)}
          {/* sensor post */}
          <line x1="92" y1="156" x2="92" y2="118" stroke="#475569" strokeWidth="1.4" />
          <rect x="86" y="114" width="12" height="6" rx="1.5" fill="#0f172a" stroke="#3b82f6" strokeWidth="0.8" />
          <circle cx="92" cy="111" r="1.8"
            fill={connectionMode !== "offline" ? "#3b82f6" : "#334155"} opacity="0.9" />
          {/* LED bars */}
          {ledOn ? (
            <>
              <line x1="58" y1="82" x2="154" y2="82"
                stroke="#fde68a" strokeWidth="3" opacity="0.85" filter="url(#mgh-glow-f)" />
              <line x1="64" y1="74" x2="160" y2="74"
                stroke="#fde68a" strokeWidth="2.5" opacity="0.75" filter="url(#mgh-glow-f)" />
              <line x1="58" y1="82" x2="154" y2="82" stroke="#fefce8" strokeWidth="1" opacity="0.95" />
              <line x1="64" y1="74" x2="160" y2="74" stroke="#fefce8" strokeWidth="0.9" opacity="0.9" />
            </>
          ) : (
            <>
              <line x1="58" y1="82" x2="154" y2="82" stroke="#1e3a5f" strokeWidth="2.5" opacity="0.6" />
              <line x1="64" y1="74" x2="160" y2="74" stroke="#1e3a5f" strokeWidth="2" opacity="0.55" />
            </>
          )}
          {/* right side wall */}
          <polygon points="177,92 177,162 200,148 200,78"
            fill={connectionMode !== "offline" ? "rgba(30,70,160,0.16)" : "rgba(15,25,55,0.14)"}
            stroke={borderColor} strokeWidth="0.75" strokeOpacity="0.3" />
          {/* fan on right wall */}
          <g transform="translate(188,116)">
            <circle cx="0" cy="0" r="9.5" fill="rgba(4,9,18,0.88)" stroke={borderColor} strokeWidth="0.7" />
            <g>
              <animateTransform attributeName="transform" type="rotate"
                from="0 0 0" to="360 0 0"
                dur={motorOn ? "0.7s" : "5s"} repeatCount="indefinite" />
              {[0, 120, 240].map((a, i) => (
                <ellipse key={i} cx="0" cy="-4" rx="1.9" ry="3.8"
                  fill={motorOn ? "#60a5fa" : "#1e3a5f"} opacity="0.88"
                  transform={`rotate(${a})`} />
              ))}
            </g>
            <circle cx="0" cy="0" r="1.8" fill="#64748b" />
          </g>
          {/* right oblique roof */}
          <path d="M108,55 Q143,55 177,92 L200,78 Q165,41 131,41 Z"
            fill={connectionMode !== "offline" ? "rgba(40,90,200,0.11)" : "rgba(15,25,55,0.09)"}
            stroke={borderColor} strokeWidth="0.8" strokeOpacity="0.4" />
          {/* front arch */}
          <path d="M40,92 Q108,18 177,92"
            fill="none" stroke={borderColor} strokeWidth="1.8" opacity="0.95" />
          {[0.25, 0.5, 0.75].map((t, i) => {
            const rx = (1 - t) * (1 - t) * 40 + 2 * t * (1 - t) * 108 + t * t * 177;
            const ry = (1 - t) * (1 - t) * 92 + 2 * t * (1 - t) * 18 + t * t * 92;
            return <line key={i} x1={rx} y1={ry} x2={rx} y2={162}
              stroke={borderColor} strokeWidth="0.5" opacity="0.13" />;
          })}
          <line x1="40" y1="92" x2="40" y2="162" stroke={borderColor} strokeWidth="1.4" opacity="0.88" />
          <line x1="177" y1="92" x2="177" y2="162" stroke={borderColor} strokeWidth="1.4" opacity="0.88" />
          <line x1="40" y1="162" x2="177" y2="162" stroke={borderColor} strokeWidth="1.1" opacity="0.65" />
          {/* HUD brackets */}
          <line x1="40" y1="162" x2="54" y2="162" stroke={borderColor} strokeWidth="1.8" opacity="0.8" />
          <line x1="40" y1="162" x2="40" y2="148" stroke={borderColor} strokeWidth="1.8" opacity="0.8" />
          <line x1="177" y1="162" x2="163" y2="162" stroke={borderColor} strokeWidth="1.8" opacity="0.8" />
          <line x1="177" y1="162" x2="177" y2="148" stroke={borderColor} strokeWidth="1.8" opacity="0.8" />
        </svg>
      ) : (
        /* ── simple arch for other greenhouses ─────────────────────── */
        <svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ height: 96 }}>
          <rect x="0" y="95" width="240" height="25" fill="#4a2e10" opacity="0.7" />
          <path d="M15,90 Q120,16 225,90 L225,95 L15,95 Z"
            fill={connectionMode !== "offline" ? "rgba(60,120,200,0.15)" : "rgba(30,50,80,0.12)"} />
          <path d="M15,90 Q120,16 225,90"
            fill="none" stroke={borderColor} strokeWidth="2" opacity="0.9" />
          <line x1="15" y1="90" x2="15" y2="95" stroke={borderColor} strokeWidth="1.5" opacity="0.8" />
          <line x1="225" y1="90" x2="225" y2="95" stroke={borderColor} strokeWidth="1.5" opacity="0.8" />
          <line x1="15" y1="95" x2="225" y2="95" stroke={borderColor} strokeWidth="1" opacity="0.45" />
          {[0.3, 0.5, 0.7].map((t, i) => {
            const px = 15 + t * 210;
            const ay = Math.pow(1 - t, 2) * 90 + 2 * t * (1 - t) * 16 + t * t * 90;
            return <line key={i} x1={px} y1={ay} x2={px} y2="95"
              stroke={borderColor} strokeWidth="0.5" opacity="0.20" />;
          })}
          {ledOn && <ellipse cx="120" cy="62" rx="72" ry="22" fill="rgba(254,220,60,0.08)" />}
          {[58, 120, 182].map((px, i) => (
            <g key={i}>
              <rect x={px - 1} y={79} width={2} height={16} fill={lf} rx={1} />
              <circle cx={px - 7} cy={82} r={6.5} fill={fr} opacity={0.9} />
              <circle cx={px + 7} cy={82} r={6.5} fill={fr} opacity={0.9} />
              <circle cx={px}     cy={76} r={6}   fill={fr} opacity={0.9} />
            </g>
          ))}
          <g transform="translate(210,82)">
            <circle cx="0" cy="0" r="10" fill="rgba(8,18,30,0.9)"
              stroke={borderColor} strokeWidth="0.8" opacity="0.7" />
            <g>
              <animateTransform attributeName="transform" type="rotate"
                from="0 0 0" to="360 0 0"
                dur={motorOn ? "0.8s" : "6s"} repeatCount="indefinite" />
              {[0, 120, 240].map((a, i) => (
                <ellipse key={i} cx="0" cy="-4.5" rx="2" ry="4"
                  fill={motorOn ? "#60a5fa" : "#2a3f55"} opacity="0.85"
                  transform={`rotate(${a})`} />
              ))}
            </g>
            <circle cx="0" cy="0" r="2" fill="#7a9ab8" />
          </g>
          <line x1="15" y1="95" x2="27" y2="95" stroke={borderColor} strokeWidth="1.5" opacity="0.7" />
          <line x1="15" y1="95" x2="15" y2="83" stroke={borderColor} strokeWidth="1.5" opacity="0.7" />
          <line x1="225" y1="95" x2="213" y2="95" stroke={borderColor} strokeWidth="1.5" opacity="0.7" />
          <line x1="225" y1="95" x2="225" y2="83" stroke={borderColor} strokeWidth="1.5" opacity="0.7" />
        </svg>
      )}

      {/* Info row */}
      <div className="px-3 pt-1 pb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: fr }}>{crop}</span>
          <div className="flex items-center gap-1">
            {ledOn && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-700/40">
                LED
              </span>
            )}
            {motorOn && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-700/40">
                风机
              </span>
            )}
          </div>
        </div>
        {/* 3 key sensor values */}
        <div className="grid grid-cols-3 gap-1">
          {([
            { key: "temp" as SensorKey,     label: "气温",  unit: "°C",  decimals: 1, isInt: false },
            { key: "humidity" as SensorKey,  label: "湿度",  unit: "%",   decimals: 0, isInt: false },
            { key: "light" as SensorKey,     label: "光照",  unit: "lux", decimals: 0, isInt: true  },
          ]).map(({ key, label, unit, decimals, isInt }) => {
            const v = sv[key];
            const display = v !== undefined ? (isInt ? Math.round(v).toString() : v.toFixed(decimals)) : "--";
            return (
              <div key={key} className="text-center rounded px-1 py-1.5" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-sm font-bold font-mono leading-none"
                  style={{ color: v !== undefined ? "#e2e8f0" : "#475569" }}>{display}</div>
                <div className="text-xs mt-0.5" style={{ color: "#475569" }}>{label}/{unit}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Focus hint */}
      <div className="absolute bottom-2 right-3 text-xs opacity-0 group-hover:opacity-50 transition-opacity"
        style={{ color: borderColor }}>
        点击聚焦 →
      </div>
    </div>
  );
}


export function RealtimeMonitor() {
  const [focusedGH, setFocusedGH] = useState<string | null>(null);
  const [sensorValues, setSensorValues] = useState<Partial<Record<SensorKey, number>>>(emptySensorValues);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("waiting");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [ledOn, setLedOn] = useState(false);
  const [motorOn, setMotorOn] = useState(false);

  // Sensor data — always fetched for ONLINE_GREENHOUSE
  useEffect(() => {
    let disposed = false;
    setConnectionMode("waiting");
    setSensorValues(emptySensorValues);

    async function hydrate() {
      try {
        const snapshot = await fetchRealtimeSnapshot(ONLINE_GREENHOUSE);
        if (!disposed && Object.keys(snapshot).length > 0) {
          setConnectionMode("live");
          setSensorValues(prev => ({ ...prev, ...snapshot }));
          setLastUpdated(new Date());
        }
      } catch { /* ignore */ }
    }
    hydrate();

    const stream = connectRealtimeStream(
      ONLINE_GREENHOUSE,
      (metrics) => {
        if (disposed) return;
        setConnectionMode("live");
        setLastUpdated(new Date());
        setSensorValues(prev => ({ ...prev, ...metrics }));
      },
      () => { if (!disposed) setConnectionMode("waiting"); },
    );
    if (!stream.connected) setConnectionMode("waiting");
    return () => { disposed = true; stream.close(); };
  }, []);

  // Device status — always for ONLINE_GREENHOUSE
  useEffect(() => {
    let disposed = false;
    let deviceId: string | null = null;
    let pollTimer: number | null = null;

    async function fetchDeviceId() {
      try {
        const devices = await fetchAllConnectedDevices();
        const bound = devices.find(d => d.greenhouseCode === ONLINE_GREENHOUSE);
        deviceId = bound?.deviceId ?? null;
      } catch { deviceId = null; }
    }
    async function pollStatus() {
      if (!deviceId || disposed) return;
      try {
        const status = await fetchRealtimeDeviceStatus(deviceId);
        if (!disposed && status) {
          setLedOn(status.led === "ON");
          setMotorOn(status.motor === "ON");
        }
      } catch { /* ignore */ }
    }
    fetchDeviceId().then(() => {
      if (!disposed) { pollStatus(); pollTimer = window.setInterval(pollStatus, 5000); }
    });
    return () => { disposed = true; if (pollTimer !== null) clearInterval(pollTimer); };
  }, []);

  const connClass = connectionMode === "live"
    ? "text-green-600 bg-green-50 border-green-200"
    : connectionMode === "waiting"
    ? "text-blue-700 bg-blue-50 border-blue-200"
    : "text-gray-700 bg-gray-50 border-gray-200";

  // ── Detail view ─────────────────────────────────────────────────────────
  if (focusedGH !== null) {
    const isOnline = focusedGH === ONLINE_GREENHOUSE;
    const ghSV = isOnline ? sensorValues : emptySensorValues;
    const ghConn: ConnectionMode = isOnline ? connectionMode : "offline";
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setFocusedGH(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            返回全景
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{focusedGH}</span>
            <span className="text-sm font-medium text-gray-500">·</span>
            <span className="text-sm font-semibold" style={{ color: CROP_COLORS[GREENHOUSE_CROPS[focusedGH] ?? "番茄"]?.[0] ?? "#ef4444" }}>
              {GREENHOUSE_CROPS[focusedGH] ?? ""}
            </span>
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${connClass}`}>
              <Wifi className={`w-3 h-3 ${connectionMode === "live" ? "animate-pulse" : ""}`} />
              {connectionMode === "live" ? "实时" : connectionMode === "waiting" ? "等待数据" : "离线"}
            </div>
            {isOnline && (
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                <Activity className="w-3 h-3" />
                {toClockTime(lastUpdated)}
              </div>
            )}
          </div>
        </div>
        <GreenhouseDigitalTwin
          sensorValues={ghSV}
          connectionMode={ghConn}
          crop={GREENHOUSE_CROPS[focusedGH] ?? "番茄"}
          ledOn={isOnline ? ledOn : false}
          motorOn={isOnline ? motorOn : false}
        />
      </div>
    );
  }

  // ── Overview grid ───────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">智慧农场 · AR数字孪生全景</h1>
          <p className="text-sm text-gray-400 mt-0.5">点击任意大棚进入实时数字孪生详情</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${connClass}`}>
            <Wifi className={`w-3.5 h-3.5 ${connectionMode === "live" ? "animate-pulse" : ""}`} />
            {connectionMode === "live" ? "1号大棚 实时在线" : connectionMode === "waiting" ? "等待数据" : "离线"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
            <Activity className="w-3.5 h-3.5" />
            {toClockTime(lastUpdated)}
          </div>
        </div>
      </div>

      {/* 6-greenhouse grid */}
      <div className="grid grid-cols-3 gap-4">
        {GREENHOUSE_LIST.map(gh => {
          const isOnline = gh === ONLINE_GREENHOUSE;
          const ghConn: ConnectionMode = isOnline ? connectionMode : "offline";
          return (
            <MiniGH
              key={gh}
              name={gh}
              crop={GREENHOUSE_CROPS[gh] ?? "番茄"}
              connectionMode={ghConn}
              sensorValues={isOnline ? sensorValues : emptySensorValues}
              ledOn={isOnline ? ledOn : false}
              motorOn={isOnline ? motorOn : false}
              onClick={() => setFocusedGH(gh)}
            />
          );
        })}
      </div>
    </div>
  );
}
