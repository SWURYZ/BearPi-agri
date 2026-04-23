/**
 * AR 3D Digital Twin — Greenhouse visualization
 *
 * ENCODING NOTE: create_file writes content literally (no JSON \uXXXX decoding).
 * Chinese text MUST be in JS string literals (const x = "\uXXXX") so TypeScript
 * processes the escape sequences at compile time. Never put \uXXXX in JSX
 * string attributes (prop="...") — they are NOT processed there.
 */
import { useEffect, useState } from "react";
import type { SensorKey } from "../services/realtime";

// ============================================================
// Props
// ============================================================
interface Props {
  sensorValues: Partial<Record<SensorKey, number>>;
  connectionMode: "live" | "waiting" | "offline";
  crop: string;
  ledOn: boolean;
  motorOn: boolean;
  /**
   * 虚拟浇水开关状态。真实硬件仅有一个 MOTOR_CONTROL,
   * 但 3D 虚拟场景里风扇与水泵展示为两个独立的电机.
   * 未传入时与 motorOn 保持一致（向后兼容）.
   */
  waterOn?: boolean;
}

// ============================================================
// Normal ranges + helpers
// ============================================================
const NR: Record<SensorKey, [number, number]> = {
  temp: [18, 30], humidity: [50, 80], light: [100, 10000],
  co2: [350, 600], soilHumidity: [30, 70], soilTemp: [15, 30],
};
function isOk(k: SensorKey, v?: number): boolean | null {
  if (v == null || !isFinite(v)) return null;
  return v >= NR[k][0] && v <= NR[k][1];
}
function statusColor(b: boolean | null) {
  return b == null ? "#64748b" : b ? "#22c55e" : "#ef4444";
}
// \u65e0 = 无, \u6570 = 数, \u636e = 据, \u6b63 = 正, \u5e38 = 常, \u5f02 = 异, \u5e38 = 常
function statusLabel(b: boolean | null): string {
  return b == null ? "\u65e0\u6570\u636e" : b ? "\u6b63\u5e38" : "\u5f02\u5e38";
}

// ============================================================
// Crop palette  [fruit-color, leaf-color]
// Keys use \uXXXX — TypeScript processes them to Chinese chars
// \u756a\u8304=番茄 \u9ec4\u74dc=黄瓜 \u8349\u8393=草莓
// \u8fa3\u6912=辣椒 \u751f\u83dc=生菜 \u8304\u5b50=茄子
// ============================================================
const CROP_PAL: Record<string, [string, string]> = {
  "\u756a\u8304": ["#ef4444", "#16a34a"],
  "\u9ec4\u74dc": ["#84cc16", "#15803d"],
  "\u8349\u8393": ["#e11d48", "#22c55e"],
  "\u8fa3\u6912": ["#dc2626", "#15803d"],
  "\u751f\u83dc": ["#4ade80", "#166534"],
  "\u8304\u5b50": ["#9333ea", "#16a34a"],
};

// ============================================================
// Plant renderers
// 真实特征设计：番茄/草莓/辣椒/茄子顶部带绿色萼片；番茄/茄子带高光；
//              黄瓜表面带深色条纹；草莓果实带籽点；生菜用卷边叶片而非简单椭圆。
// ============================================================
type PP = { cx: number; by: number; s: number; fr: string; lf: string };

/** 绿色五角星萼片（番茄/草莓/茄子顶部通用） */
function Sepal({ cx, cy, r, color = "#166534" }: { cx: number; cy: number; r: number; color?: string }) {
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  }).join(" ");
  return (
    <g>
      <polygon points={pts} fill={color} opacity={0.9} />
      <circle cx={cx} cy={cy} r={r * 0.35} fill={color} />
    </g>
  );
}

function Tomato({ cx, by, s, fr, lf }: PP) {
  // 深浅红交替（有未熟有熟），更贴合真实番茄串
  const darker = "#b91c1c";
  return (
    <g>
      {/* 主茎 */}
      <rect x={cx - 1.5 * s} y={by - 72 * s} width={3 * s} height={72 * s} fill={lf} rx={1.5 * s} />
      {/* 枝叶 */}
      <line x1={cx} y1={by - 30 * s} x2={cx - 14 * s} y2={by - 40 * s} stroke={lf} strokeWidth={1.5 * s} />
      <line x1={cx} y1={by - 50 * s} x2={cx + 13 * s} y2={by - 58 * s} stroke={lf} strokeWidth={1.5 * s} />
      <ellipse cx={cx - 14 * s} cy={by - 43 * s} rx={8 * s} ry={5 * s} fill={lf} opacity={0.8}
        transform={`rotate(-20,${cx - 14 * s},${by - 43 * s})`} />
      <ellipse cx={cx + 13 * s} cy={by - 61 * s} rx={8 * s} ry={5 * s} fill={lf} opacity={0.8}
        transform={`rotate(20,${cx + 13 * s},${by - 61 * s})`} />
      {/* 果实（略扁球） */}
      {[
        { x: -8, y: -22, r: 7,   c: fr },
        { x:  8, y: -22, r: 7.5, c: fr },
        { x:  0, y: -40, r: 7,   c: darker },
        { x: -9, y: -54, r: 6,   c: fr },
        { x:  8, y: -56, r: 6.5, c: darker },
      ].map((t, i) => (
        <g key={i}>
          <ellipse cx={cx + t.x * s} cy={by + t.y * s} rx={t.r * s} ry={t.r * 0.94 * s} fill={t.c} />
          {/* 高光 */}
          <ellipse cx={cx + (t.x - t.r * 0.3) * s} cy={by + (t.y - t.r * 0.35) * s}
            rx={t.r * 0.28 * s} ry={t.r * 0.18 * s} fill="#fff" opacity={0.42} />
          {/* 绿色萼片 */}
          <Sepal cx={cx + t.x * s} cy={by + (t.y - t.r * 0.85) * s} r={t.r * 0.48 * s} />
        </g>
      ))}
    </g>
  );
}

function Cucumber({ cx, by, s, fr, lf }: PP) {
  const stripe = "#4d7c0f"; // 黄瓜深绿条纹
  return (
    <g>
      {/* 主茎 */}
      <rect x={cx - 1.5 * s} y={by - 80 * s} width={3 * s} height={80 * s} fill={lf} rx={1.5 * s} />
      {/* 心形叶（放大的椭圆模拟） */}
      <line x1={cx} y1={by - 20 * s} x2={cx - 18 * s} y2={by - 28 * s} stroke={lf} strokeWidth={1.5 * s} />
      <line x1={cx} y1={by - 45 * s} x2={cx + 18 * s} y2={by - 52 * s} stroke={lf} strokeWidth={1.5 * s} />
      <line x1={cx} y1={by - 65 * s} x2={cx - 16 * s} y2={by - 72 * s} stroke={lf} strokeWidth={1.5 * s} />
      <ellipse cx={cx - 18 * s} cy={by - 31 * s} rx={9 * s} ry={6 * s} fill={lf} opacity={0.85} />
      <ellipse cx={cx + 18 * s} cy={by - 55 * s} rx={9 * s} ry={6 * s} fill={lf} opacity={0.85} />
      <ellipse cx={cx - 16 * s} cy={by - 75 * s} rx={8.5 * s} ry={5.5 * s} fill={lf} opacity={0.85} />
      {/* 黄色小花（黄瓜特征） */}
      <circle cx={cx + 7 * s} cy={by - 77 * s} r={2.5 * s} fill="#facc15" />
      {/* 黄瓜果（细长 + 深色条纹） */}
      {[
        { x:  5, y: -15, rx: 5,   ry: 10 },
        { x: -6, y: -38, rx: 4.5, ry: 9  },
        { x:  6, y: -60, rx: 5,   ry: 10 },
      ].map((t, i) => (
        <g key={i}>
          <ellipse cx={cx + t.x * s} cy={by + t.y * s} rx={t.rx * s} ry={t.ry * s} fill={fr} />
          {/* 深色纵向条纹 */}
          <line
            x1={cx + (t.x - t.rx * 0.4) * s} y1={by + (t.y - t.ry * 0.7) * s}
            x2={cx + (t.x - t.rx * 0.4) * s} y2={by + (t.y + t.ry * 0.7) * s}
            stroke={stripe} strokeWidth={0.8 * s} opacity={0.7}
          />
          <line
            x1={cx + (t.x + t.rx * 0.4) * s} y1={by + (t.y - t.ry * 0.7) * s}
            x2={cx + (t.x + t.rx * 0.4) * s} y2={by + (t.y + t.ry * 0.7) * s}
            stroke={stripe} strokeWidth={0.8 * s} opacity={0.7}
          />
          {/* 高光 */}
          <ellipse cx={cx + (t.x - t.rx * 0.3) * s} cy={by + (t.y - t.ry * 0.4) * s}
            rx={t.rx * 0.25 * s} ry={t.ry * 0.4 * s} fill="#fff" opacity={0.35} />
        </g>
      ))}
    </g>
  );
}

function Strawberry({ cx, by, s, fr, lf }: PP) {
  return (
    <g>
      <rect x={cx - s} y={by - 50 * s} width={2 * s} height={50 * s} fill={lf} rx={s} />
      <line x1={cx} y1={by - 12 * s} x2={cx - 14 * s} y2={by - 18 * s} stroke={lf} strokeWidth={1.5 * s} />
      <line x1={cx} y1={by - 28 * s} x2={cx + 13 * s} y2={by - 34 * s} stroke={lf} strokeWidth={1.5 * s} />
      {/* 三出复叶（齿缘用 polyline 近似锯齿） */}
      <ellipse cx={cx - 14 * s} cy={by - 20 * s} rx={8 * s} ry={4.5 * s} fill={lf} opacity={0.9} />
      <ellipse cx={cx + 13 * s} cy={by - 36 * s} rx={7.5 * s} ry={4.5 * s} fill={lf} opacity={0.9} />
      {/* 心形果 + 萼片 + 籽点 */}
      {[[-6, -8], [6, -8], [0, -18], [-7, -25], [6, -26], [-3, -36]].map(([dx, dy], i) => {
        const bx = cx + dx * s;
        const by0 = by + dy * s;
        return (
          <g key={i}>
            {/* 心形果实：上宽下尖 */}
            <path
              d={`M${bx - 5 * s},${by0 - 3 * s}
                  C${bx - 5 * s},${by0 - 8 * s} ${bx - 1 * s},${by0 - 9 * s} ${bx},${by0 - 5 * s}
                  C${bx + 1 * s},${by0 - 9 * s} ${bx + 5 * s},${by0 - 8 * s} ${bx + 5 * s},${by0 - 3 * s}
                  C${bx + 5 * s},${by0 + 1 * s} ${bx},${by0 + 5 * s} ${bx},${by0 + 5 * s}
                  C${bx},${by0 + 5 * s} ${bx - 5 * s},${by0 + 1 * s} ${bx - 5 * s},${by0 - 3 * s} Z`}
              fill={fr}
            />
            {/* 高光 */}
            <ellipse cx={bx - 1.8 * s} cy={by0 - 3.5 * s} rx={1.2 * s} ry={1.8 * s} fill="#fff" opacity={0.45} />
            {/* 籽点（黄色小点，草莓最辨识特征） */}
            {[[-2, -2], [2, -1], [-1, 1], [1.5, 2], [-2.5, 0.5]].map(([sx, sy], j) => (
              <circle key={j} cx={bx + sx * s} cy={by0 + sy * s} r={0.4 * s} fill="#fde68a" />
            ))}
            {/* 绿色萼片（紧贴果实上方） */}
            <Sepal cx={bx} cy={by0 - 6 * s} r={2.6 * s} color="#166534" />
          </g>
        );
      })}
    </g>
  );
}

function Chili({ cx, by, s, fr, lf }: PP) {
  return (
    <g>
      <rect x={cx - 1.5 * s} y={by - 75 * s} width={3 * s} height={75 * s} fill={lf} rx={1.5 * s} />
      <line x1={cx} y1={by - 20 * s} x2={cx - 16 * s} y2={by - 26 * s} stroke={lf} strokeWidth={1.5 * s} />
      <line x1={cx} y1={by - 42 * s} x2={cx + 15 * s} y2={by - 48 * s} stroke={lf} strokeWidth={1.5 * s} />
      <line x1={cx} y1={by - 60 * s} x2={cx - 14 * s} y2={by - 65 * s} stroke={lf} strokeWidth={1.5 * s} />
      <ellipse cx={cx - 16 * s} cy={by - 29 * s} rx={8.5 * s} ry={4.5 * s} fill={lf} opacity={0.8} />
      <ellipse cx={cx + 15 * s} cy={by - 51 * s} rx={8 * s} ry={4.5 * s} fill={lf} opacity={0.8} />
      <ellipse cx={cx - 14 * s} cy={by - 68 * s} rx={7.5 * s} ry={4.5 * s} fill={lf} opacity={0.8} />
      {/* 下垂辣椒：细长锥，顶部带绿色蒂把 */}
      {[
        { x: -8, y: -10, bend:  3, len: 16 },
        { x:  7, y: -28, bend:  3, len: 18 },
        { x: -6, y: -48, bend:  3, len: 16 },
        { x:  8, y: -62, bend:  3, len: 16 },
      ].map((t, i) => {
        const tx = cx + t.x * s, ty = by + t.y * s;
        const tipX = cx + (t.x + t.bend) * s, tipY = by + (t.y + t.len) * s;
        return (
          <g key={i}>
            {/* 辣椒主体 */}
            <path
              d={`M${tx - 2.2 * s},${ty}
                  Q${tx + t.bend * 0.5 * s},${ty + t.len * 0.5 * s} ${tipX},${tipY}
                  Q${tx + t.bend * 0.5 * s + 2.2 * s},${ty + t.len * 0.5 * s} ${tx + 2.2 * s},${ty} Z`}
              fill={fr}
            />
            {/* 高光条 */}
            <line x1={tx - 0.5 * s} y1={ty + 1 * s} x2={tx + t.bend * 0.5 * s - 0.5 * s}
              y2={ty + t.len * 0.5 * s} stroke="#fff" strokeWidth={0.6 * s} opacity={0.4} />
            {/* 绿色蒂把 */}
            <rect x={tx - 2.5 * s} y={ty - 2.5 * s} width={5 * s} height={3 * s}
              fill="#15803d" rx={0.8 * s} />
          </g>
        );
      })}
    </g>
  );
}

function Lettuce({ cx, by, s, fr, lf }: PP) {
  // 外圈大卷叶（波浪边缘用 path 模拟），内圈嫩叶
  const ruffleLeaf = (ang: number, rx: number, ry: number, fill: string, opacity = 0.85) => {
    const rad = (ang * Math.PI) / 180;
    const ex = cx + Math.cos(rad) * 10 * s;
    const ey = by - 8 * s + Math.sin(rad) * 5 * s;
    // 卷边用 M-Q-Q-Q 画一个波浪形叶
    const p = `M${ex - rx * s},${ey}
      Q${ex - rx * 0.6 * s},${ey - ry * 1.3 * s} ${ex},${ey - ry * s}
      Q${ex + rx * 0.6 * s},${ey - ry * 1.3 * s} ${ex + rx * s},${ey}
      Q${ex + rx * 0.6 * s},${ey + ry * 0.6 * s} ${ex},${ey + ry * 0.4 * s}
      Q${ex - rx * 0.6 * s},${ey + ry * 0.6 * s} ${ex - rx * s},${ey} Z`;
    return (
      <path
        key={ang}
        d={p}
        fill={fill}
        opacity={opacity}
        transform={`rotate(${ang},${ex},${ey})`}
      />
    );
  };
  return (
    <g>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) =>
        ruffleLeaf(a, 9, 5, i % 2 === 0 ? lf : "#22c55e", 0.85),
      )}
      {/* 内圈嫩叶 */}
      {[22, 112, 202, 292].map((a) => ruffleLeaf(a, 6, 3.5, fr, 0.9))}
      {/* 叶球芯 */}
      <circle cx={cx} cy={by - 8 * s} r={5 * s} fill={fr} />
      <ellipse cx={cx - 1.5 * s} cy={by - 10 * s} rx={2 * s} ry={1.5 * s} fill="#fff" opacity={0.4} />
    </g>
  );
}

function Eggplant({ cx, by, s, fr, lf }: PP) {
  return (
    <g>
      <rect x={cx - 1.5 * s} y={by - 78 * s} width={3 * s} height={78 * s} fill={lf} rx={1.5 * s} />
      <line x1={cx} y1={by - 22 * s} x2={cx - 16 * s} y2={by - 30 * s} stroke={lf} strokeWidth={1.5 * s} />
      <line x1={cx} y1={by - 48 * s} x2={cx + 15 * s} y2={by - 55 * s} stroke={lf} strokeWidth={1.5 * s} />
      <ellipse cx={cx - 16 * s} cy={by - 33 * s} rx={8.5 * s} ry={5 * s} fill={lf} opacity={0.85} />
      <ellipse cx={cx + 15 * s} cy={by - 58 * s} rx={8 * s} ry={5 * s} fill={lf} opacity={0.85} />
      {/* 紫色长椭圆果 + 高光 + 绿色萼片 */}
      {[
        { x:  4, y: -15, rx: 7,   ry: 12 },
        { x: -5, y: -42, rx: 6.5, ry: 11 },
        { x:  5, y: -65, rx: 6,   ry: 10 },
      ].map((t, i) => (
        <g key={i}>
          {/* 果实 */}
          <ellipse cx={cx + t.x * s} cy={by + t.y * s} rx={t.rx * s} ry={t.ry * s} fill={fr} />
          {/* 深紫阴影 */}
          <ellipse cx={cx + (t.x + t.rx * 0.4) * s} cy={by + (t.y + t.ry * 0.2) * s}
            rx={t.rx * 0.55 * s} ry={t.ry * 0.7 * s} fill="#581c87" opacity={0.35} />
          {/* 高光（茄子表皮有明显光泽） */}
          <ellipse cx={cx + (t.x - t.rx * 0.35) * s} cy={by + (t.y - t.ry * 0.3) * s}
            rx={t.rx * 0.2 * s} ry={t.ry * 0.5 * s} fill="#fff" opacity={0.45} />
          {/* 绿色顶萼片（茄子标志性） */}
          <Sepal cx={cx + t.x * s} cy={by + (t.y - t.ry * 0.95) * s} r={t.rx * 0.85 * s} color="#166534" />
        </g>
      ))}
    </g>
  );
}

// ============================================================
// Plants composite
// ============================================================
const PLANT_POS = [
  { cx: 202, by: 393, s: 1.0 },
  { cx: 293, by: 393, s: 1.0 },
  { cx: 384, by: 393, s: 1.0 },
  { cx: 248, by: 378, s: 0.82 },
  { cx: 340, by: 378, s: 0.82 },
];

function Plants({ crop, ledOn }: { crop: string; ledOn: boolean }) {
  const [fr, lf] = CROP_PAL[crop] ?? CROP_PAL["\u756a\u8304"];
  function R(pos: typeof PLANT_POS[0], i: number) {
    const p: PP = { ...pos, fr, lf };
    switch (crop) {
      case "\u756a\u8304": return <Tomato     key={i} {...p} />;
      case "\u9ec4\u74dc": return <Cucumber   key={i} {...p} />;
      case "\u8349\u8393": return <Strawberry key={i} {...p} />;
      case "\u8fa3\u6912": return <Chili      key={i} {...p} />;
      case "\u751f\u83dc": return <Lettuce    key={i} {...p} />;
      case "\u8304\u5b50": return <Eggplant   key={i} {...p} />;
      default:             return <Tomato     key={i} {...p} />;
    }
  }
  return (
    <g style={{ filter: ledOn ? "brightness(1.18) saturate(1.12)" : undefined }}>
      {R(PLANT_POS[3], 3)}{R(PLANT_POS[4], 4)}
      {R(PLANT_POS[0], 0)}{R(PLANT_POS[1], 1)}{R(PLANT_POS[2], 2)}
    </g>
  );
}

// ============================================================
// Badge (SVG overlay)  — NO icon prop, label via JSX expression
// ============================================================
interface BadgeProps {
  x: number; y: number;
  label: string;
  value?: number; unit: string;
  sensorKey: SensorKey;
}
function Badge({ x, y, label, value, unit, sensorKey }: BadgeProps) {
  const ok = isOk(sensorKey, value);
  const color = statusColor(ok);
  const slabel = statusLabel(ok);
  const display = value !== undefined
    ? (sensorKey === "light" || sensorKey === "co2"
        ? Math.round(value).toString()
        : value.toFixed(1))
    : "--";
  return (
    <g>
      <rect x={x} y={y} width={112} height={54} rx={7}
        fill="rgba(6,12,28,0.93)" stroke={color} strokeWidth="1.5" />
      <rect x={x} y={y} width={112} height={18} rx={7} fill={color} opacity={0.14} />
      <rect x={x} y={y + 11} width={112} height={7} fill={color} opacity={0.10} />
      {/* label text */}
      <text x={x + 8} y={y + 13} fontSize="11" fill={color} fontWeight="700"
        fontFamily="system-ui,sans-serif">{label}</text>
      {/* status dot */}
      <circle cx={x + 102} cy={y + 9} r={3.5} fill={color} opacity={0.9} />
      {/* value */}
      <text x={x + 8} y={y + 39} fontSize="19" fontWeight="bold" fill="white"
        fontFamily="ui-monospace,monospace">{display}</text>
      <text x={x + 8 + display.length * 10.8} y={y + 39} fontSize="10" fill="#94a3b8"
        fontFamily="system-ui,sans-serif">{unit}</text>
      {/* status */}
      <text x={x + 104} y={y + 50} fontSize="9" fill={color} textAnchor="end"
        fontFamily="system-ui,sans-serif">{slabel}</text>
    </g>
  );
}

// ============================================================
// DataPanel (HTML bottom bar)
// ============================================================
function DataPanel({ sv, frameColor }: { sv: Partial<Record<SensorKey, number>>; frameColor: string }) {
  // Items defined as JS objects — \uXXXX processed by TypeScript
  const items: { key: SensorKey; zh: string; unit: string }[] = [
    { key: "temp",         zh: "\u6c14\u6e29",      unit: "\u00b0C" },
    { key: "humidity",     zh: "\u6e7f\u5ea6",      unit: "%"       },
    { key: "light",        zh: "\u5149\u7167",      unit: "lux"     },
    { key: "co2",          zh: "CO\u2082",           unit: "ppm"     },
    { key: "soilHumidity", zh: "\u571f\u58e4\u6e7f", unit: "%"      },
    { key: "soilTemp",     zh: "\u571f\u58e4\u6e29", unit: "\u00b0C"},
  ];
  return (
    <div className="flex items-stretch border-t divide-x"
      style={{ borderColor: `${frameColor}33`, background: "rgba(4,10,22,0.97)" }}>
      {items.map(({ key, zh, unit }) => {
        const v = sv[key];
        const ok = isOk(key, v);
        const color = statusColor(ok);
        const display = v !== undefined
          ? (key === "light" || key === "co2" ? Math.round(v).toString() : v.toFixed(1))
          : "--";
        return (
          <div key={key} className="flex-1 flex flex-col items-center py-2 px-1 gap-0.5"
            style={{ borderColor: `${frameColor}22` }}>
            <span className="text-xs" style={{ color: "#64748b" }}>{zh}</span>
            <span className="text-lg font-bold font-mono leading-none" style={{ color }}>{display}</span>
            <span className="text-xs" style={{ color: "#475569" }}>{unit}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================
export function GreenhouseDigitalTwin({ sensorValues: sv, connectionMode, crop, ledOn, motorOn, waterOn }: Props) {
  const pumpOn = waterOn ?? motorOn; // 未传入单独的水泵开关时,默认跟随风扇状态
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Status
  const KEYS: SensorKey[] = ["temp", "humidity", "light", "co2", "soilHumidity", "soilTemp"];
  const allOks = KEYS.map(k => isOk(k, sv[k])).filter(v => v !== null);
  const hasAlert = allOks.some(v => v === false);
  const frameColor = allOks.length === 0 ? "#475569" : hasAlert ? "#ef4444" : "#22c55e";
  const glassRgb = hasAlert ? "80,30,30" : "60,120,200";
  const [, cropLf] = CROP_PAL[crop] ?? CROP_PAL["\u756a\u8304"];

  // ── Label constants (JS string literals → TypeScript processes \uXXXX) ──
  // These are in JS context, so TypeScript correctly decodes the escapes.
  const lTemp  = "\u6c14\u6e29";         // 气温
  const lHum   = "\u6e7f\u5ea6";         // 湿度
  const lSHum  = "\u571f\u58e4\u6e7f";   // 土壤湿
  const lSTemp = "\u571f\u58e4\u6e29";   // 土壤温
  const lLight = "\u5149\u7167";         // 光照
  const lCo2   = "CO\u2082";             // CO₂
  const uDeg   = "\u00b0C";              // °C
  const mdot   = "\u00b7";              // ·

  // ── String constants for JSX ──
  const arTitle   = "AR \u6570\u5b57\u5b5a\u751f";  // AR 数字孪生
  const connLabel = connectionMode === "live"
    ? "\u5b9e\u65f6"     // 实时
    : connectionMode === "waiting"
    ? "\u7b49\u5f85"     // 等待
    : "\u79bb\u7ebf";    // 离线
  const alertText = "\u26a0 \u73af\u5883\u5f02\u5e38"; // ⚠ 环境异常
  const ledLabel  = "\u8865\u5149\u706f";  // 补光灯
  const fanLabel  = "\u98ce\u673a";        // 风机
  const pumpLabel = "\u6c34\u6cf5";        // 水泵

  const connClass = connectionMode === "live"
    ? "bg-green-900/50 text-green-300 border-green-700"
    : connectionMode === "waiting"
    ? "bg-blue-900/50 text-blue-300 border-blue-700"
    : "bg-gray-800/80 text-gray-400 border-gray-600";

  return (
    <div className="relative w-full overflow-hidden rounded-2xl flex flex-col"
      style={{ background: "linear-gradient(160deg,#050c18 0%,#0d1c30 55%,#050c18 100%)" }}>

      {/* ── Header ribbon ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: `${frameColor}30`, background: "rgba(4,10,22,0.82)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0"
            style={{ boxShadow: "0 0 6px #4ade80" }} />
          <span className="text-green-300 text-xs font-bold tracking-widest">{arTitle}</span>
          <span className="text-cyan-400 text-xs">{mdot}</span>
          <span className="text-cyan-300 text-xs font-semibold">{crop}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${connClass}`}>
            {connLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            ledOn ? "bg-yellow-900/50 border-yellow-600 text-yellow-300"
                  : "bg-gray-800/80 border-gray-600 text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ledOn ? "bg-yellow-400" : "bg-gray-600"}`} />
            {ledLabel}
          </span>
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            motorOn ? "bg-blue-900/50 border-blue-600 text-blue-300"
                    : "bg-gray-800/80 border-gray-600 text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${motorOn ? "bg-blue-400" : "bg-gray-600"}`} />
            {fanLabel}
          </span>
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            pumpOn ? "bg-cyan-900/50 border-cyan-600 text-cyan-300"
                   : "bg-gray-800/80 border-gray-600 text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pumpOn ? "bg-cyan-400" : "bg-gray-600"}`} />
            {pumpLabel}
          </span>
          {hasAlert && (
            <span className="bg-red-900/70 border border-red-500 text-red-300 text-xs px-3 py-0.5 rounded-full animate-pulse">
              {alertText}
            </span>
          )}
        </div>
      </div>

      {/* ── 3D SVG ── */}
      <svg viewBox="0 0 760 430" xmlns="http://www.w3.org/2000/svg" className="w-full block">
        <defs>
          <linearGradient id="dt-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#040a14" />
            <stop offset="100%" stopColor="#0c1d33" />
          </linearGradient>
          <linearGradient id="dt-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a5030" stopOpacity="0.70" />
            <stop offset="100%" stopColor="#3a1e0a" stopOpacity="0.90" />
          </linearGradient>
          <linearGradient id="dt-glass-front" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`rgb(${glassRgb})`} stopOpacity="0.18" />
            <stop offset="100%" stopColor={`rgb(${glassRgb})`} stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="dt-roof-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`rgb(${glassRgb})`} stopOpacity="0.35" />
            <stop offset="100%" stopColor={`rgb(${glassRgb})`} stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="dt-wall-r" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#182838" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#0d1d2c" stopOpacity="0.98" />
          </linearGradient>
          <filter id="dt-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width="760" height="430" fill="url(#dt-sky)" />

        {/* AR grid */}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`gv${i}`} x1={69 * i} y1="0" x2={69 * i} y2="430"
            stroke={frameColor} strokeWidth="0.22" opacity="0.07" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`gh${i}`} x1="0" y1={62 * i} x2="760" y2={62 * i}
            stroke={frameColor} strokeWidth="0.22" opacity="0.07" />
        ))}

        {/* Ground */}
        <rect x="0" y="370" width="760" height="60" fill="#4a2e10" opacity="0.55" />
        <line x1="0" y1="370" x2="760" y2="370" stroke={cropLf} strokeWidth="0.8" opacity="0.15" />

        {/* Interior floor / soil beds */}
        <polygon points="140,400 445,400 495,370 190,370" fill="url(#dt-floor)" />
        {[80, 175, 270].map(dx => (
          <line key={dx} x1={140 + dx} y1={400} x2={140 + dx + 50} y2={370}
            stroke={cropLf} strokeWidth="0.8" opacity="0.22" />
        ))}

        {/* Raised planting beds */}
        {[0, 1, 2].map(row => (
          <rect key={row} x={148 + row * 96} y={388} width={86 + row * 10} height={14}
            fill="#5c3015" stroke="#7a4520" strokeWidth="0.8" rx={2} opacity={0.8} />
        ))}

        {/* Back arch */}
        <path d="M190,215 Q342,50 495,215"
          fill="none" stroke={frameColor} strokeWidth="1.8" opacity="0.35"
          filter="url(#dt-glow)" />
        <line x1="190" y1="215" x2="190" y2="370" stroke={frameColor} strokeWidth="1.2" opacity="0.30" />
        <line x1="495" y1="215" x2="495" y2="370" stroke={frameColor} strokeWidth="1.2" opacity="0.30" />
        <line x1="190" y1="370" x2="495" y2="370" stroke={frameColor} strokeWidth="0.8" opacity="0.20" />
        {[0.3, 0.5, 0.7].map((t, i) => {
          const bx = 190 + t * 305;
          const ay = Math.pow(1 - t, 2) * 215 + 2 * t * (1 - t) * 50 + t * t * 215;
          return <line key={i} x1={bx} y1={ay} x2={bx} y2="370"
            stroke={frameColor} strokeWidth="0.7" opacity="0.18" />;
        })}

        {/* LED glow */}
        {ledOn && (
          <ellipse cx="295" cy="240" rx="195" ry="110" fill="rgba(254,220,60,0.05)">
            <animate attributeName="opacity" values="0.05;0.09;0.05" dur="3s" repeatCount="indefinite" />
          </ellipse>
        )}

        <Plants crop={crop} ledOn={ledOn} />

        {/* LED grow-light bars */}
        {([
          [208, 195, 258, 168],
          [272, 193, 322, 166],
          [336, 191, 386, 164],
          [400, 191, 450, 164],
        ] as [number, number, number, number][]).map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            <polygon
              points={`${x1 - 2},${y1 + 2} ${x2 - 2},${y2 + 2} ${x2 + 2},${y2 - 2} ${x1 + 2},${y1 - 2}`}
              fill={ledOn ? "#fef08a" : "#1e3040"}
              stroke={ledOn ? "#fbbf24" : "#2d4050"} strokeWidth="0.8" />
            {ledOn && (
              <polygon
                points={`${x1 - 2},${y1} ${x2 - 2},${y2} ${x2 + 28},${y2 + 55} ${x1 + 28},${y1 + 55}`}
                fill="rgba(254,220,60,0.06)">
                <animate attributeName="opacity" values="0.06;0.12;0.06"
                  dur={`${2.2 + i * 0.35}s`} repeatCount="indefinite" />
              </polygon>
            )}
          </g>
        ))}

        {/* Right side wall */}
        <polygon points="445,400 495,370 495,215 445,245"
          fill="url(#dt-wall-r)" stroke={frameColor} strokeWidth="1.5" />
        {[298, 320, 342].map((y, i) => (
          <line key={i} x1={448} y1={y} x2={492} y2={y - 20}
            stroke={frameColor} strokeWidth="0.8" opacity="0.35" />
        ))}
        <polygon points="455,278 480,265 480,248 455,260"
          fill="rgba(80,160,220,0.10)" stroke={frameColor} strokeWidth="0.8" opacity="0.55" />

        {/* Control box */}
        <rect x="450" y="250" width="32" height="22" rx="2"
          fill="rgba(10,20,35,0.90)" stroke={frameColor} strokeWidth="0.8" opacity="0.7" />
        <rect x="454" y="254" width="6" height="5" rx="1"
          fill={ledOn ? "#fef08a" : "#1a2535"} opacity="0.9" />
        <rect x="462" y="254" width="6" height="5" rx="1"
          fill={motorOn ? "#60a5fa" : "#1a2535"} opacity="0.9" />
        <rect x="470" y="254" width="6" height="5" rx="1"
          fill={pumpOn ? "#22d3ee" : "#1a2535"} opacity="0.9" />
        <rect x="454" y="263" width="19" height="2" rx="0.5" fill={frameColor} opacity="0.3" />

        {/* Fan */}
        <g transform="translate(470,310)">
          <circle cx="0" cy="0" r="19" fill="rgba(12,25,42,0.95)" stroke={frameColor} strokeWidth="1.2" />
          <g>
            <animateTransform attributeName="transform" type="rotate"
              from="0 0 0" to="360 0 0"
              dur={motorOn ? "0.6s" : "5s"} repeatCount="indefinite" />
            {[0, 120, 240].map((angle, i) => (
              <ellipse key={i} cx="0" cy="-10" rx="4" ry="8"
                fill={motorOn ? "#60a5fa" : "#2a3f55"} opacity="0.88"
                transform={`rotate(${angle})`} />
            ))}
          </g>
          <circle cx="0" cy="0" r="2.8" fill="#7a9ab8" />
        </g>
        {motorOn && (
          <circle cx="488" cy="294" r="3.5" fill="#22c55e">
            <animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite" />
          </circle>
        )}

        {/* 虚拟水泵电机 — 位于左侧地面, 独立于风扇的第二个虚拟电机 */}
        {/* 水管 (从地面延伸到各种植单床) */}
        <g opacity={pumpOn ? 0.9 : 0.55}>
          <line x1="186" y1="360" x2="186" y2="395" stroke="#1e3a5f" strokeWidth="2.2" />
          <line x1="186" y1="395" x2="430" y2="395" stroke="#1e3a5f" strokeWidth="1.8" />
          {[170, 220, 270, 320, 370].map(dx => (
            <circle key={dx} cx={dx + 30} cy="395" r="1.4" fill={pumpOn ? "#22d3ee" : "#334155"} opacity={pumpOn ? 0.9 : 0.5} />
          ))}
        </g>
        {/* 水泵主体 (圆旋转叶片) */}
        <g transform="translate(186,355)">
          <circle cx="0" cy="0" r="16" fill="rgba(8,22,38,0.95)"
            stroke={pumpOn ? "#22d3ee" : frameColor} strokeWidth="1.3"
            opacity={pumpOn ? 0.95 : 0.7} />
          {/* 水泵叶轮 (4 片, 与风扇 3 片区分) */}
          <g>
            <animateTransform attributeName="transform" type="rotate"
              from="0 0 0" to="-360 0 0"
              dur={pumpOn ? "0.45s" : "6s"} repeatCount="indefinite" />
            {[0, 90, 180, 270].map((angle, i) => (
              <path key={i}
                d="M 0 -2 Q 3 -5 0 -10 Q -3 -5 0 -2 Z"
                fill={pumpOn ? "#22d3ee" : "#2a3f55"}
                opacity="0.92"
                transform={`rotate(${angle})`} />
            ))}
          </g>
          <circle cx="0" cy="0" r="2.4" fill="#94a3b8" />
          {/* 进水口 (向上) */}
          <rect x="-3" y="-22" width="6" height="8" rx="1"
            fill="rgba(8,22,38,0.9)" stroke={pumpOn ? "#22d3ee" : frameColor} strokeWidth="0.7" />
          {/* 出水口 (向右接水管) */}
          <rect x="10" y="-3" width="8" height="6" rx="1"
            fill="rgba(8,22,38,0.9)" stroke={pumpOn ? "#22d3ee" : frameColor} strokeWidth="0.7" />
        </g>
        {/* 水泵运行时的水滴动画 */}
        {pumpOn && (
          <>
            {[200, 250, 310, 360, 405].map((x, i) => (
              <circle key={i} cx={x} cy="395" r="1.6" fill="#7dd3fc" opacity="0.85">
                <animate attributeName="cy" values="395;402;395" dur={`${0.8 + i * 0.12}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.2;0.9" dur={`${0.8 + i * 0.12}s`} repeatCount="indefinite" />
              </circle>
            ))}
            <circle cx="186" cy="360" r="4" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.75">
              <animate attributeName="r" values="4;20;4" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.75;0;0.75" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="176" cy="352" r="2.8" fill="#22c55e">
              <animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        {/* Front arch */}
        <path d="M140,245 Q292,80 445,245 L445,400 L140,400 Z" fill="url(#dt-glass-front)" />
        <path d="M140,245 Q292,80 445,245"
          fill="none" stroke={frameColor} strokeWidth="2.8" filter="url(#dt-glow)" />
        {[0.25, 0.5, 0.75].map((t, i) => {
          const px = 140 + t * 305;
          const ay = Math.pow(1 - t, 2) * 245 + 2 * t * (1 - t) * 80 + t * t * 245;
          return <line key={i} x1={px} y1={ay} x2={px} y2="400"
            stroke={frameColor} strokeWidth="0.85" opacity="0.25" />;
        })}
        <line x1="140" y1="245" x2="140" y2="400" stroke={frameColor} strokeWidth="2.2" opacity="0.85" />
        <line x1="445" y1="245" x2="445" y2="400" stroke={frameColor} strokeWidth="2.2" opacity="0.85" />
        <line x1="140" y1="400" x2="445" y2="400" stroke={frameColor} strokeWidth="1.5" opacity="0.70" />
        <line x1="140" y1="322" x2="445" y2="322" stroke={frameColor} strokeWidth="0.9" opacity="0.22" />

        {/* Door */}
        <rect x="272" y="318" width="62" height="82" rx="2"
          fill="rgba(8,16,28,0.55)" stroke={frameColor} strokeWidth="1.1" opacity="0.70" />
        <line x1="303" y1="318" x2="303" y2="400" stroke={frameColor} strokeWidth="0.7" opacity="0.50" />
        <circle cx="310" cy="360" r="2.5" fill={frameColor} opacity="0.6" />
        <circle cx="296" cy="360" r="2.5" fill={frameColor} opacity="0.6" />

        {/* Arch ridge connector */}
        <line x1="292" y1="163" x2="342" y2="133"
          stroke={frameColor} strokeWidth="2.2" opacity="0.65" filter="url(#dt-glow)" />
        <path d="M292,163 Q368,162 445,245 L495,215 Q418,132 342,133 Z"
          fill="url(#dt-roof-side)" stroke={frameColor} strokeWidth="1.5" />

        {/* Scan line */}
        <line x1="140" y1="0" x2="445" y2="0"
          stroke={frameColor} strokeWidth="1" opacity="0.15">
          <animateTransform attributeName="transform" type="translate"
            values="0,200; 0,420; 0,200" dur="6s" repeatCount="indefinite" />
        </line>

        {/* HUD corner brackets */}
        {([[140, 400, 1, -1], [445, 400, -1, -1], [140, 245, 1, 1], [445, 245, -1, 1]] as [number, number, number, number][]).map(([bx, by2, sx, sy], i) => (
          <g key={i}>
            <line x1={bx} y1={by2} x2={bx + 16 * sx} y2={by2} stroke={frameColor} strokeWidth="2" opacity="0.75" />
            <line x1={bx} y1={by2} x2={bx} y2={by2 + 16 * sy} stroke={frameColor} strokeWidth="2" opacity="0.75" />
          </g>
        ))}

        {/* ── Sensor badges  (labels via JSX expressions → JS string literals → processed by TypeScript) ── */}
        <Badge x={14}  y={48}  label={lTemp}  value={sv.temp}         unit={uDeg} sensorKey="temp" />
        <Badge x={14}  y={116} label={lHum}   value={sv.humidity}     unit="%" sensorKey="humidity" />
        <Badge x={14}  y={184} label={lSHum}  value={sv.soilHumidity} unit="%" sensorKey="soilHumidity" />
        <Badge x={14}  y={252} label={lSTemp} value={sv.soilTemp}     unit={uDeg} sensorKey="soilTemp" />
        <Badge x={636} y={48}  label={lLight} value={sv.light}        unit="lux" sensorKey="light" />
        <Badge x={636} y={116} label={lCo2}   value={sv.co2}          unit="ppm" sensorKey="co2" />

        {/* Connector lines */}
        <line x1="126" y1="75"  x2="140" y2="290" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.25" />
        <line x1="126" y1="143" x2="140" y2="310" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.25" />
        <line x1="126" y1="211" x2="190" y2="370" stroke="#10b981" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.25" />
        <line x1="636" y1="75"  x2="445" y2="193" stroke="#eab308" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.25" />
        <line x1="636" y1="143" x2="470" y2="291" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.25" />

        {/* Timestamp */}
        <text x="10" y="425" fontSize="8" fill={frameColor} opacity="0.28"
          fontFamily="ui-monospace,monospace">
          {crop}{" "}{mdot}{" AR-TWIN v3 "}{mdot}{" "}{new Date().toLocaleTimeString()}
        </text>
        <text x="750" y="425" fontSize="8" fill={frameColor} opacity="0.28"
          fontFamily="ui-monospace,monospace" textAnchor="end">
          {allOks.length === 0 ? "NO DATA" : hasAlert ? "ALERT" : "NOMINAL"}
        </text>
      </svg>

      {/* ── Bottom data panel ── */}
      <DataPanel sv={sv} frameColor={frameColor} />
    </div>
  );
}
