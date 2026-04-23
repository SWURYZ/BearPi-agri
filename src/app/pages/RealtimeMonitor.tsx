import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Wifi, ChevronLeft, Lightbulb, Fan, Loader2, Droplets, Clock, SlidersHorizontal, AlertTriangle, Plus, Trash2, X } from "lucide-react";
import {
  SENSOR_KEYS,
  type SensorKey,
  connectRealtimeStream,
  fetchRealtimeSnapshot,
} from "../services/realtime";
import { fetchAllConnectedDevices } from "../services/greenhouseMonitor";
import { fetchRealtimeDeviceStatus, sendManualControl } from "../services/deviceControl";
import { GreenhouseDigitalTwin } from "../components/GreenhouseDigitalTwin3D";
import { ScheduleRulesModal, ThresholdRulesModal, AlertRecordsModal } from "../components/GreenhousePanels";
import { FarmDigitalTwin3D, type FarmGreenhouse } from "../components/FarmDigitalTwin3D";
import { useGreenhouses, CROP_OPTIONS, LOCKED_NAME, MAX_GREENHOUSES } from "../lib/greenhouseStore";
import { useVirtualSwitches, type VirtualSwitch } from "../lib/virtualSwitchStore";

// Crop colors [fruit, leaf] for mini card plants
const CROP_COLORS: Record<string, [string, string]> = {
  "番茄": ["#ef4444", "#16a34a"], "黄瓜": ["#84cc16", "#15803d"],
  "草莓": ["#e11d48", "#22c55e"], "辣椒": ["#dc2626", "#15803d"],
  "生菜": ["#4ade80", "#166534"], "茄子": ["#9333ea", "#16a34a"],
};

type ConnectionMode = "live" | "waiting" | "offline";

// 绑定真实硬件的大棚 (固定名称、不可删除)
const ONLINE_GREENHOUSE = LOCKED_NAME;

const emptySensorValues: Partial<Record<SensorKey, number>> = SENSOR_KEYS.reduce(
  (acc, k) => { acc[k] = undefined; return acc; },
  {} as Partial<Record<SensorKey, number>>,
);

// 其他大棚的传感器模拟值以 1号大棚的实时数据为基础,
// 加上根据大棚名称稳定偏移 (同名同 key 偏移不变、不随机跳动)
// 1号大棚没有数据时使用合理默认值。
const FALLBACK_BASE: Record<SensorKey, number> = {
  temp: 24, humidity: 60, light: 8000, co2: 600, soilHumidity: 45, soilTemp: 22,
};
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
function simulateSensorValues(
  base: Partial<Record<SensorKey, number>>,
  ghName: string,
): Partial<Record<SensorKey, number>> {
  const out: Partial<Record<SensorKey, number>> = {};
  for (const key of SENSOR_KEYS) {
    const baseVal = (base[key] ?? FALLBACK_BASE[key]) as number;
    // 偏移因子: 根据大棚名 + key 哈希出 [-0.15, +0.15]
    const h = hashStr(ghName + "|" + key);
    const factor = 1 + ((h % 1000) / 1000 - 0.5) * 0.3; // ±15%
    let v = baseVal * factor;
    // 合理范围限制
    if (key === "humidity" || key === "soilHumidity") v = Math.max(0, Math.min(100, v));
    if (key === "co2") v = Math.max(350, v);
    if (key === "light") v = Math.max(0, v);
    out[key] = Math.round(v * 10) / 10;
  }
  return out;
}

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
  // 大棚清单 (localStorage 持久化, 支持增删改作物)
  const { list: ghList, addGreenhouse, removeGreenhouse, updateCrop, canAdd } = useGreenhouses();
  const GREENHOUSE_LIST = useMemo(() => ghList.map((g) => g.name), [ghList]);
  const GREENHOUSE_CROPS = useMemo<Record<string, string>>(
    () => Object.fromEntries(ghList.map((g) => [g.name, g.crop])),
    [ghList],
  );
  const [manageOpen, setManageOpen] = useState(false);

  // ── 本地持久化 key (切换页面/刷新后保留状态) ──
  const LS_FOCUSED = "bearpi:monitor:focusedGH";
  const LS_VIRTUAL = "bearpi:monitor:virtualSwitches";
  const LS_WATER = "bearpi:monitor:waterOn";
  type VirtualSwitch = { led: boolean; motor: boolean; water: boolean };
  const loadLS = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const [focusedGH, setFocusedGH] = useState<string | null>(() => loadLS<string | null>(LS_FOCUSED, null));
  const [sensorValues, setSensorValues] = useState<Partial<Record<SensorKey, number>>>(emptySensorValues);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("waiting");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [ledOn, setLedOn] = useState(false);
  const [motorOn, setMotorOn] = useState(false);
  const [ledLoading, setLedLoading] = useState(false);
  const [motorLoading, setMotorLoading] = useState(false);
  const [waterLoading, setWaterLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [controlMessage, setControlMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // 待确认目标值 — 用户点击后立即写入,轮询只接受与目标值一致的状态
  // 这样可以避免设备执行慢时,旧的 "ON" 状态把刚切换的 "OFF" 覆盖回去
  const ledPendingTargetRef = useRef<boolean | null>(null);
  const motorPendingTargetRef = useRef<boolean | null>(null);
  // 1 号大棚浇水(虚拟) — 持久化
  const [waterOn, setWaterOn] = useState(() => loadLS<boolean>(LS_WATER, false));
  // 其他大棚的虚拟设备状态 — 通过共享 store (跨组件, 包含芽芽自动播报写入, 内部已持久化)
  const [virtualSwitchMap, updateVirtualSwitch] = useVirtualSwitches();
  const virtualSwitches = useMemo<Record<string, VirtualSwitch>>(() => {
    const next: Record<string, VirtualSwitch> = {};
    for (const gh of GREENHOUSE_LIST) {
      next[gh] = virtualSwitchMap[gh] ?? { led: false, motor: false, water: false };
    }
    return next;
  }, [GREENHOUSE_LIST, virtualSwitchMap]);

  // 切换/刷新后保留状态:focusedGH / waterOn 持久化
  useEffect(() => {
    try {
      if (focusedGH) localStorage.setItem(LS_FOCUSED, JSON.stringify(focusedGH));
      else localStorage.removeItem(LS_FOCUSED);
    } catch { /* ignore quota */ }
  }, [focusedGH]);
  useEffect(() => {
    try { localStorage.setItem(LS_WATER, JSON.stringify(waterOn)); } catch { /* ignore */ }
  }, [waterOn]);
  function toggleVirtual(gh: string, key: keyof VirtualSwitch) {
    const cur = virtualSwitches[gh] ?? { led: false, motor: false, water: false };
    updateVirtualSwitch(gh, { [key]: !cur[key] });
  }

  // 弹窗开关:定时规则 / 阈值规则 / 告警记录
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [alertRecOpen, setAlertRecOpen] = useState(false);

  // 如果当前聚焦大棚被删除, 自动返回全景
  useEffect(() => {
    if (focusedGH && !GREENHOUSE_LIST.includes(focusedGH)) {
      setFocusedGH(null);
    }
  }, [focusedGH, GREENHOUSE_LIST]);

  // 监听芽芽语音指令："聚焦/查看 N 号大棚" → 切到详情视图
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ greenhouse: string }>).detail;
      if (!detail?.greenhouse) return;
      if (GREENHOUSE_LIST.includes(detail.greenhouse)) {
        setFocusedGH(detail.greenhouse);
      }
    };
    const backHandler = () => setFocusedGH(null);
    window.addEventListener("yaya:focus-greenhouse", handler as EventListener);
    window.addEventListener("yaya:focus-greenhouse-back", backHandler as EventListener);
    return () => {
      window.removeEventListener("yaya:focus-greenhouse", handler as EventListener);
      window.removeEventListener("yaya:focus-greenhouse-back", backHandler as EventListener);
    };
  }, []);

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

  // Device status — fetch device binding & poll status
  useEffect(() => {
    let disposed = false;
    let pollTimer: number | null = null;

    async function init() {
      try {
        const devices = await fetchAllConnectedDevices();
        if (disposed) return;
        if (devices.length === 0) {
          setDeviceId("");
          return;
        }
        // 排除手机扫码绑定设备 (MOBILE_SCANNER), 它们无法执行 LIGHT/MOTOR 控制指令.
        // 真实硬件 greenhouseCode 形如 "GH-01", 手机设备 greenhouseCode 为 "1号大棚" —
        // 命名不一致, 旧逻辑 find("1号大棚") 会命中手机而不是硬件, 导致"点开关硬件不变".
        const isHardware = (d: { deviceType: string | null }) =>
          !d.deviceType || d.deviceType.toUpperCase() !== "MOBILE_SCANNER";
        const hardwareDevices = devices.filter(isHardware);
        const pool = hardwareDevices.length > 0 ? hardwareDevices : devices;

        // 1号大棚对应的 greenhouseCode 兼容两种写法: "1号大棚" 或 "GH-01"
        const ghAliases = [ONLINE_GREENHOUSE, "GH-01"];
        const bound = pool.find(d => ghAliases.includes(d.greenhouseCode)) ?? pool[0];
        setDeviceId(bound.deviceId);
      } catch {
        if (!disposed) setDeviceId("");
      }
    }

    async function pollStatus(id: string) {
      if (!id || disposed) return;
      try {
        const status = await fetchRealtimeDeviceStatus(id);
        if (!disposed && status) {
          if (status.led) {
            const real = status.led === "ON";
            // 有待确认目标:只在状态匹配目标时才接受并清除 pending
            // 否则保持本地乐观值不变,避免覆盖用户刚刚的操作
            if (ledPendingTargetRef.current === null) {
              setLedOn(real);
            } else if (ledPendingTargetRef.current === real) {
              setLedOn(real);
              ledPendingTargetRef.current = null;
              setLedLoading(false);
            }
          }
          if (status.motor) {
            const real = status.motor === "ON";
            if (motorPendingTargetRef.current === null) {
              setMotorOn(real);
              if (!real) setWaterOn(false); // 硬件电机关闭时, 水泵场景也强制停止
            } else if (motorPendingTargetRef.current === real) {
              setMotorOn(real);
              if (!real) setWaterOn(false);
              motorPendingTargetRef.current = null;
              setMotorLoading(false);
            }
          }
        }
      } catch { /* ignore */ }
    }

    init();
    pollTimer = window.setInterval(() => {
      if (deviceId) pollStatus(deviceId);
    }, 2000);
    return () => { disposed = true; if (pollTimer !== null) clearInterval(pollTimer); };
  }, [deviceId]);

  // 自动清除提示
  useEffect(() => {
    if (!controlMessage) return;
    const t = window.setTimeout(() => setControlMessage(null), 2500);
    return () => clearTimeout(t);
  }, [controlMessage]);

  // 控制 LED / 风扇 (与 DeviceControl 逻辑一致)
  // - loading 只锁 API 调用期间，响应后立刻释放
  // - pendingTarget 保护乐观值:只在"硬件真实达到目标"或"用户下次点击"时清除,
  //   避免硬件离线/云端异常时,旧 telemetry 把 UI 拉回旧状态.
  async function toggleLed() {
    if (!deviceId || ledLoading) {
      if (!deviceId) setControlMessage({ type: "error", text: "未绑定设备,请先在【设备管理】扫码绑定" });
      return;
    }
    const target = !ledOn;
    setLedLoading(true);
    ledPendingTargetRef.current = target;
    setLedOn(target); // 乐观更新
    try {
      const resp = await sendManualControl({ deviceId, commandType: "LIGHT_CONTROL", action: target ? "ON" : "OFF" });
      const ok = resp.status === "SENT" || resp.status === "DELIVERED";
      if (ok) {
        setControlMessage({ type: "success", text: `补光灯指令已下发: ${target ? "ON" : "OFF"}` });
        // 1.2s 后主动同步一次 (仅在设备已报告达目标时接受,避免覆盖乐观值)
        window.setTimeout(async () => {
          try {
            const realtime = await fetchRealtimeDeviceStatus(deviceId);
            if (realtime?.led) {
              const real = realtime.led === "ON";
              if (real === target) {
                setLedOn(real);
                ledPendingTargetRef.current = null;
              }
            }
          } catch { /* ignore */ }
        }, 1200);
      } else {
        // SKIPPED(云平台未配置) / FAILED(云平台异常/设备离线): 保留 UI 为用户期望值,
        // pendingTarget 继续保护,防止轮询回写旧状态.仅以提示告知用户.
        const simulated = resp.status === "SKIPPED";
        setControlMessage({
          type: simulated ? "success" : "error",
          text: simulated
            ? "本地模拟: 云平台未启用,指令未真正下发"
            : (resp.message || "云端下发失败,已保留本地显示"),
        });
      }
    } catch {
      // 网络错误: 保留 UI 为用户期望值,继续让 pendingTarget 保护
      setControlMessage({ type: "error", text: "网络错误,已保留本地显示" });
    } finally {
      setLedLoading(false); // 按钮立即可再点
    }
  }
  async function toggleMotor() {
    if (!deviceId || motorLoading) {
      if (!deviceId) setControlMessage({ type: "error", text: "未绑定设备,请先在【设备管理】扫码绑定" });
      return;
    }
    const target = !motorOn;
    setMotorLoading(true);
    motorPendingTargetRef.current = target;
    setMotorOn(target);
    try {
      const resp = await sendManualControl({ deviceId, commandType: "MOTOR_CONTROL", action: target ? "ON" : "OFF" });
      const ok = resp.status === "SENT" || resp.status === "DELIVERED";
      if (ok) {
        setControlMessage({ type: "success", text: `风扇指令已下发: ${target ? "ON" : "OFF"}` });
        window.setTimeout(async () => {
          try {
            const realtime = await fetchRealtimeDeviceStatus(deviceId);
            if (realtime?.motor) {
              const real = realtime.motor === "ON";
              if (real === target) {
                setMotorOn(real);
                motorPendingTargetRef.current = null;
              }
            }
          } catch { /* ignore */ }
        }, 1200);
      } else {
        const simulated = resp.status === "SKIPPED";
        setControlMessage({
          type: simulated ? "success" : "error",
          text: simulated
            ? "本地模拟: 云平台未启用,指令未真正下发"
            : (resp.message || "云端下发失败,已保留本地显示"),
        });
      }
    } catch {
      setControlMessage({ type: "error", text: "网络错误,已保留本地显示" });
    } finally {
      setMotorLoading(false);
    }
  }

  // 浇水控制
  // · 1号大棚: 与风扇共用 MOTOR_CONTROL 硬件 — 下发真实指令
  // · 虚拟场景中 waterOn 与 motorOn 独立显示 (分别控制水泵动画与风扇动画)
  async function toggleWater() {
    if (!deviceId) {
      setControlMessage({ type: "error", text: "未绑定设备,请先在【设备管理】扫码绑定" });
      return;
    }
    if (motorLoading) return;
    const target = !waterOn;
    setWaterLoading(true);
    motorPendingTargetRef.current = target;
    setWaterOn(target); // 只设置水泵状态, 风扇保持独立
    try {
      const resp = await sendManualControl({ deviceId, commandType: "MOTOR_CONTROL", action: target ? "ON" : "OFF" });
      const ok = resp.status === "SENT" || resp.status === "DELIVERED";
      if (ok) {
        setControlMessage({ type: "success", text: `浇水指令已下发: ${target ? "ON" : "OFF"}` });
        window.setTimeout(async () => {
          try {
            const realtime = await fetchRealtimeDeviceStatus(deviceId);
            if (realtime?.motor) {
              const real = realtime.motor === "ON";
              if (real === target) {
                setWaterOn(real);
                motorPendingTargetRef.current = null;
              }
            }
          } catch { /* ignore */ }
        }, 1200);
      } else {
        const simulated = resp.status === "SKIPPED";
        setControlMessage({
          type: simulated ? "success" : "error",
          text: simulated
            ? "本地模拟: 云平台未启用,指令未真正下发"
            : (resp.message || "云端下发失败,已保留本地显示"),
        });
      }
    } catch {
      setControlMessage({ type: "error", text: "网络错误,已保留本地显示" });
    } finally {
      setWaterLoading(false);
    }
  }

  const connClass = connectionMode === "live"
    ? "text-green-600 bg-green-50 border-green-200"
    : connectionMode === "waiting"
    ? "text-blue-700 bg-blue-50 border-blue-200"
    : "text-gray-700 bg-gray-50 border-gray-200";

  // ── Detail view ─────────────────────────────────────────────────────────
  if (focusedGH !== null) {
    const isOnline = focusedGH === ONLINE_GREENHOUSE;
    const ghSV = isOnline ? sensorValues : simulateSensorValues(sensorValues, focusedGH);
    const ghConn: ConnectionMode = isOnline ? connectionMode : "offline";
    const vs = virtualSwitches[focusedGH] ?? { led: false, motor: false, water: false };
    // 1号大棚:补光灯/风扇用真实设备状态;浇水用虚拟
    // 其他大棚:三个开关全部虚拟
    const ghLedOn = isOnline ? ledOn : vs.led;
    const ghMotorOn = isOnline ? motorOn : vs.motor;
    const ghWaterOn = isOnline ? waterOn : vs.water;

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={() => setFocusedGH(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            返回全景
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">{focusedGH}</span>
            <span className="text-sm font-medium text-gray-500">·</span>
            <span className="text-sm font-semibold" style={{ color: CROP_COLORS[GREENHOUSE_CROPS[focusedGH] ?? "番茄"]?.[0] ?? "#ef4444" }}>
              {GREENHOUSE_CROPS[focusedGH] ?? ""}
            </span>
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${connClass}`}>
              <Wifi className={`w-3 h-3 ${connectionMode === "live" ? "animate-pulse" : ""}`} />
              {isOnline ? (connectionMode === "live" ? "实时" : connectionMode === "waiting" ? "等待数据" : "离线") : "虚拟模拟"}
            </div>
            {isOnline && (
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                <Activity className="w-3 h-3" />
                {toClockTime(lastUpdated)}
              </div>
            )}

            {/* === 控制按钮:补光灯 / 风扇 / 浇水 === */}
            <button
              onClick={isOnline ? toggleLed : () => toggleVirtual(focusedGH, "led")}
              disabled={isOnline && (ledLoading || !deviceId)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                ghLedOn
                  ? "bg-amber-50 border-amber-300 text-amber-700 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:border-amber-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isOnline ? (!deviceId ? "未绑定设备" : ghLedOn ? "点击关闭补光灯" : "点击开启补光灯") : "虚拟模拟开关"}
            >
              {isOnline && ledLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
              补光灯 {ghLedOn ? "ON" : "OFF"}
            </button>

            <button
              onClick={isOnline ? toggleMotor : () => toggleVirtual(focusedGH, "motor")}
              disabled={isOnline && (motorLoading || !deviceId)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                ghMotorOn
                  ? "bg-blue-50 border-blue-300 text-blue-700 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-200"
              } disabled:cursor-wait`}
              title={isOnline ? (!deviceId ? "未绑定设备" : ghMotorOn ? "点击关闭风扇" : "点击开启风扇") : "虚拟模拟开关"}
            >
              {isOnline && motorLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Fan className={`w-3 h-3 ${ghMotorOn ? "animate-spin" : ""}`} />}
              风扇 {ghMotorOn ? "ON" : "OFF"}
            </button>

            <button
              onClick={isOnline ? toggleWater : () => toggleVirtual(focusedGH, "water")}
              disabled={isOnline && (waterLoading || !deviceId)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                ghWaterOn
                  ? "bg-cyan-50 border-cyan-300 text-cyan-700 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:border-cyan-200"
              } disabled:cursor-wait`}
              title={isOnline ? (!deviceId ? "未绑定设备" : "浇水与电机为同一硬件 (MOTOR_CONTROL)") : "虚拟浇水开关(场景模拟)"}
            >
              {isOnline && waterLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Droplets className={`w-3 h-3 ${ghWaterOn ? "animate-pulse" : ""}`} />}
              浇水 {ghWaterOn ? "ON" : "OFF"}
            </button>
          </div>
        </div>
        <GreenhouseDigitalTwin
          sensorValues={ghSV}
          connectionMode={ghConn}
          crop={GREENHOUSE_CROPS[focusedGH] ?? "番茄"}
          ledOn={ghLedOn}
          motorOn={ghMotorOn}
          waterOn={ghWaterOn}
        />

        {/* 测量数据下方 — 定时规则 / 阈值规则 / 告警记录 入口按钮 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">设备规则与告警</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isOnline
                  ? `针对当前大棚设备 ${deviceId || "未绑定"} 的定时控制、阈值告警与记录查看。`
                  : "当前为虚拟大棚,接入真实设备后可使用。"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setScheduleOpen(true)}
              disabled={!isOnline || !deviceId}
              className="group flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gradient-to-br from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 hover:border-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-50 disabled:to-gray-50"
            >
              <div className="p-2.5 bg-white rounded-xl shadow-sm">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">定时规则</div>
                <div className="text-xs text-gray-500 truncate">补光灯 / 灬溉自动定时</div>
              </div>
            </button>

            <button
              onClick={() => setThresholdOpen(true)}
              disabled={!isOnline || !deviceId}
              className="group flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-50 disabled:to-gray-50"
            >
              <div className="p-2.5 bg-white rounded-xl shadow-sm">
                <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">阈值规则</div>
                <div className="text-xs text-gray-500 truncate">温度 / 湿度 / 光照 / CO2 超限告警</div>
              </div>
            </button>

            <button
              onClick={() => setAlertRecOpen(true)}
              disabled={!isOnline || !deviceId}
              className="group flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gradient-to-br from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 hover:border-rose-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-50 disabled:to-gray-50"
            >
              <div className="p-2.5 bg-white rounded-xl shadow-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">告警记录</div>
                <div className="text-xs text-gray-500 truncate">查看历史阈值超限记录</div>
              </div>
            </button>
          </div>
        </div>

        {/* 弹窗 */}
        <ScheduleRulesModal
          open={scheduleOpen}
          deviceId={isOnline ? deviceId : ""}
          greenhouseLabel={focusedGH}
          onClose={() => setScheduleOpen(false)}
        />
        <ThresholdRulesModal
          open={thresholdOpen}
          deviceId={isOnline ? deviceId : ""}
          greenhouseLabel={focusedGH}
          onClose={() => setThresholdOpen(false)}
        />
        <AlertRecordsModal
          open={alertRecOpen}
          deviceId={isOnline ? deviceId : ""}
          greenhouseLabel={focusedGH}
          onClose={() => setAlertRecOpen(false)}
        />
      </div>
    );
  }

  // ── Overview grid ───────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 relative">
      {/* 控制反馈 Toast */}
      {controlMessage && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
            controlMessage.type === "success"
              ? "bg-green-50 border border-green-300 text-green-700"
              : "bg-red-50 border border-red-300 text-red-700"
          }`}
        >
          {controlMessage.type === "success" ? "✓" : "✕"} {controlMessage.text}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">智慧农场 · AR数字孪生全景</h1>
          <p className="text-sm text-gray-400 mt-0.5">点击任意大棚进入实时数字孪生详情</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700 transition-all"
            title="新增或删除大棚"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="font-semibold">管理大棚</span>
            <span className="text-gray-400">({ghList.length}/{MAX_GREENHOUSES})</span>
          </button>
        </div>
      </div>

      {/* 全农场 3D 大屏（1 张卡片包含 6 个大棚） */}
      <FarmDigitalTwin3D
        greenhouses={GREENHOUSE_LIST.map<FarmGreenhouse>((gh) => {
          const isOnline = gh === ONLINE_GREENHOUSE;
          const vs = virtualSwitches[gh] ?? { led: false, motor: false, water: false };
          return {
            name: gh,
            crop: GREENHOUSE_CROPS[gh] ?? "番茄",
            ledOn: isOnline ? ledOn : vs.led,
            motorOn: isOnline ? motorOn : vs.motor,
            waterOn: isOnline ? waterOn : vs.water,
            connectionMode: isOnline ? connectionMode : "offline",
            hasAlert: false,
          };
        })}
        onSelect={(name) => setFocusedGH(name)}
      />

      {/* 管理大棚对话框 */}
      {manageOpen && (
        <ManageGreenhousesModal
          list={ghList}
          canAdd={canAdd}
          onClose={() => setManageOpen(false)}
          onAdd={addGreenhouse}
          onRemove={removeGreenhouse}
          onUpdateCrop={updateCrop}
        />
      )}
    </div>
  );
}

// ============================================================
// 管理大棚对话框 — 新增/删除/改作物
// ============================================================
interface ManageModalProps {
  list: { name: string; crop: string; locked: boolean }[];
  canAdd: boolean;
  onClose: () => void;
  onAdd: (name: string, crop: string) => { ok: boolean; error?: string };
  onRemove: (name: string) => { ok: boolean; error?: string };
  onUpdateCrop: (name: string, crop: string) => { ok: boolean; error?: string };
}

function ManageGreenhousesModal({ list, canAdd, onClose, onAdd, onRemove, onUpdateCrop }: ManageModalProps) {
  const [newName, setNewName] = useState("");
  const [newCrop, setNewCrop] = useState<string>(CROP_OPTIONS[0]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 推测下一个可用编号, 方便用户快速填写
  useEffect(() => {
    const used = new Set(
      list
        .map((g) => {
          const m = /^(\d+)号大棚$/.exec(g.name);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter((n): n is number => n != null),
    );
    let next = 1;
    while (used.has(next)) next++;
    setNewName(`${next}号大棚`);
  }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  const handleAdd = () => {
    const r = onAdd(newName, newCrop);
    if (r.ok) {
      setMessage({ type: "success", text: `已新增: ${newName.trim()}` });
    } else {
      setMessage({ type: "error", text: r.error ?? "新增失败" });
    }
  };

  const handleRemove = (name: string) => {
    if (!window.confirm(`确定删除 "${name}" 吗? 此操作不可恢复.`)) return;
    const r = onRemove(name);
    if (r.ok) setMessage({ type: "success", text: `已删除: ${name}` });
    else setMessage({ type: "error", text: r.error ?? "删除失败" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">管理大棚</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              共 {list.length} / {MAX_GREENHOUSES} 个 · 1 号大棚绑定真实硬件不可删除
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mx-5 mt-3 px-3 py-2 rounded-lg text-xs ${
              message.type === "success"
                ? "bg-green-50 border border-green-300 text-green-700"
                : "bg-red-50 border border-red-300 text-red-700"
            }`}
          >
            {message.type === "success" ? "✓" : "✕"} {message.text}
          </div>
        )}

        {/* Add form */}
        <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-600 mb-2">新增大棚</div>
          <div className="flex gap-2 flex-wrap">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="大棚名称 (如: 7号大棚)"
              maxLength={16}
              className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-green-400"
            />
            <select
              value={newCrop}
              onChange={(e) => setNewCrop(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-green-400 bg-white"
            >
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              新增
            </button>
          </div>
          {!canAdd && (
            <p className="text-xs text-red-500 mt-2">已达上限 ({MAX_GREENHOUSES})，请先删除部分大棚</p>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto px-5 py-3">
          <div className="text-xs font-semibold text-gray-600 mb-2">现有大棚</div>
          <div className="space-y-2">
            {list.map((g) => (
              <div
                key={g.name}
                className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                    {g.locked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                        真实硬件
                      </span>
                    )}
                  </div>
                </div>
                <select
                  value={g.crop}
                  onChange={(e) => onUpdateCrop(g.name, e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-green-400"
                >
                  {CROP_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleRemove(g.name)}
                  disabled={g.locked}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  title={g.locked ? "绑定真实硬件,不可删除" : "删除"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
