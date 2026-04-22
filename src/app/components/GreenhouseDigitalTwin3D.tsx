/**
 * 3D Digital Twin — Greenhouse visualization (real WebGL via three.js + R3F)
 *
 * 与设备状态实时同步：
 *  - ledOn  → 顶部补光灯亮起，发射黄光 PointLight，地面有黄色光晕
 *  - motorOn → 风扇 4 叶片旋转（关闭时静止）
 *  - 6 项传感器值通过 HTML overlay 显示
 *  - OrbitControls 支持鼠标拖拽 / 缩放
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
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
}

// ============================================================
// Normal ranges
// ============================================================
const NR: Record<SensorKey, [number, number]> = {
  temp: [18, 30],
  humidity: [50, 80],
  light: [100, 10000],
  co2: [350, 600],
  soilHumidity: [30, 70],
  soilTemp: [15, 30],
};
function isOk(k: SensorKey, v?: number): boolean | null {
  if (v == null || !isFinite(v)) return null;
  return v >= NR[k][0] && v <= NR[k][1];
}
function statusColor(b: boolean | null) {
  return b == null ? "#64748b" : b ? "#22c55e" : "#ef4444";
}

// ============================================================
// 作物配色：[fruit, leaf]
// ============================================================
const CROP_PAL: Record<string, [string, string]> = {
  "番茄": ["#ef4444", "#16a34a"],
  "黄瓜": ["#84cc16", "#15803d"],
  "草莓": ["#f43f5e", "#15803d"],
  "辣椒": ["#dc2626", "#15803d"],
  "生菜": ["#4ade80", "#166534"],
  "茄子": ["#7c3aed", "#15803d"],
};

// ============================================================
// 单株作物（叶 + 果实）
// ============================================================
function CropPlant({ position, fruitColor, leafColor, ledOn }: {
  position: [number, number, number];
  fruitColor: string;
  leafColor: string;
  ledOn: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // 让作物在补光时轻微"呼吸"
  useFrame((state) => {
    if (groupRef.current && ledOn) {
      const t = state.clock.elapsedTime;
      groupRef.current.scale.y = 1 + Math.sin(t * 1.5 + position[0]) * 0.03;
    } else if (groupRef.current) {
      groupRef.current.scale.y = 1;
    }
  });
  return (
    <group ref={groupRef} position={position}>
      {/* 茎 */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.04, 0.3, 8]} />
        <meshStandardMaterial color="#65a30d" />
      </mesh>
      {/* 叶丛（多个圆锥模拟） */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.12, 0.3, Math.sin(angle) * 0.12]}
            rotation={[0, angle, Math.PI / 6]}
            castShadow
          >
            <coneGeometry args={[0.1, 0.25, 6]} />
            <meshStandardMaterial color={leafColor} />
          </mesh>
        );
      })}
      {/* 顶部主叶 */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color={leafColor} />
      </mesh>
      {/* 果实 */}
      <mesh position={[0.08, 0.3, 0.04]} castShadow>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color={fruitColor} emissive={fruitColor} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-0.07, 0.27, -0.05]} castShadow>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color={fruitColor} emissive={fruitColor} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// ============================================================
// 补光灯灯条 (LED grow light)
// ============================================================
function GrowLight({ position, on }: { position: [number, number, number]; on: boolean }) {
  return (
    <group position={position}>
      {/* 灯壳 */}
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.08, 0.2]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 灯面 */}
      <mesh position={[0, -0.045, 0]}>
        <boxGeometry args={[1.45, 0.02, 0.18]} />
        <meshStandardMaterial
          color={on ? "#fef3c7" : "#374151"}
          emissive={on ? "#fde047" : "#000000"}
          emissiveIntensity={on ? 1.5 : 0}
        />
      </mesh>
      {/* 实际光源 */}
      {on && (
        <pointLight
          position={[0, -0.5, 0]}
          intensity={2.2}
          distance={5}
          decay={1.6}
          color="#fde68a"
          castShadow
        />
      )}
      {/* 吊杆 */}
      <mesh position={[-0.65, 0.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.8]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0.65, 0.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.8]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
    </group>
  );
}

// ============================================================
// 风扇（电机驱动叶片旋转）
// ============================================================
function Fan({ position, on }: { position: [number, number, number]; on: boolean }) {
  const bladesRef = useRef<THREE.Group>(null);
  // 平滑加减速避免突跳
  const speedRef = useRef(0);
  useFrame((_, delta) => {
    const target = on ? 12 : 0;
    speedRef.current += (target - speedRef.current) * Math.min(1, delta * 4);
    if (bladesRef.current) bladesRef.current.rotation.z += speedRef.current * delta;
  });

  const ringRadius = 0.42;
  return (
    <group position={position} rotation={[0, 0, 0]}>
      {/* 外环 */}
      <mesh>
        <torusGeometry args={[ringRadius, 0.04, 12, 32]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* 后部支架 */}
      <mesh position={[0, 0, -0.15]}>
        <boxGeometry args={[0.95, 0.95, 0.04]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.5} transparent opacity={0.6} />
      </mesh>
      {/* 叶片组 */}
      <group ref={bladesRef}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <boxGeometry args={[0.7, 0.13, 0.03]} />
            <meshStandardMaterial
              color={on ? "#60a5fa" : "#475569"}
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
        ))}
        {/* 中心轴 */}
        <mesh>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
      </group>
      {/* 工作指示灯 */}
      <mesh position={[ringRadius - 0.06, ringRadius - 0.06, 0.05]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial
          color={on ? "#22c55e" : "#7f1d1d"}
          emissive={on ? "#22c55e" : "#7f1d1d"}
          emissiveIntensity={on ? 1.2 : 0.2}
        />
      </mesh>
    </group>
  );
}

// ============================================================
// 大棚结构（地面 + 植床 + 玻璃罩）
// ============================================================
function GreenhouseShell({ alert }: { alert: boolean }) {
  const glassColor = alert ? "#7f1d1d" : "#3b82f6";
  return (
    <group>
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#3f2a1a" roughness={0.9} />
      </mesh>
      {/* 植床（3 列） */}
      {[-1.6, 0, 1.6].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.1, 4]} />
          <meshStandardMaterial color="#5a2f17" roughness={0.85} />
        </mesh>
      ))}
      {/* 玻璃外罩 - 拱形顶（半圆柱体）使用 -PI/2 让拱顶在上方 */}
      <mesh position={[0, 1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 4.2, 32, 1, true, 0, Math.PI]} />
        <meshPhysicalMaterial
          color={glassColor}
          transparent
          opacity={0.22}
          roughness={0.05}
          transmission={0.7}
          thickness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 前后山墙 */}
      {[-2.1, 2.1].map((z) => (
        <mesh key={z} position={[0, 1.4, z]}>
          <circleGeometry args={[1.6, 32, 0, Math.PI]} />
          <meshPhysicalMaterial
            color={glassColor}
            transparent
            opacity={0.25}
            roughness={0.05}
            transmission={0.85}
            thickness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* 框架钢梁 - 拱筋 */}
      {[-2, -1, 0, 1, 2].map((z) => (
        <group key={z} position={[0, 0, z]}>
          {Array.from({ length: 16 }).map((_, i) => {
            const a1 = (i / 16) * Math.PI;
            const a2 = ((i + 1) / 16) * Math.PI;
            const x1 = Math.cos(a1) * 1.6;
            const y1 = Math.sin(a1) * 1.6;
            const x2 = Math.cos(a2) * 1.6;
            const y2 = Math.sin(a2) * 1.6;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 + 1.4;
            const len = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            return (
              <mesh key={i} position={[mx, my - 1.4 + 1.4, 0]} rotation={[0, 0, angle]}>
                <boxGeometry args={[len, 0.04, 0.04]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.4} />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* 地基底框 */}
      {[-2.1, 2.1].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[3.4, 0.08, 0.08]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================
// 作物群（按列种植）
// ============================================================
function CropField({ crop, ledOn }: { crop: string; ledOn: boolean }) {
  const [fruit, leaf] = CROP_PAL[crop] ?? CROP_PAL["番茄"];
  const positions = useMemo<[number, number, number][]>(() => {
    const arr: [number, number, number][] = [];
    [-1.6, 0, 1.6].forEach((x) => {
      for (let z = -1.7; z <= 1.7; z += 0.55) {
        arr.push([x, 0.1, z]);
      }
    });
    return arr;
  }, []);
  return (
    <>
      {positions.map((p, i) => (
        <CropPlant key={i} position={p} fruitColor={fruit} leafColor={leaf} ledOn={ledOn} />
      ))}
    </>
  );
}

// ============================================================
// 主场景（在 Canvas 内）
// ============================================================
function Scene({ crop, ledOn, motorOn, alert }: { crop: string; ledOn: boolean; motorOn: boolean; alert: boolean }) {
  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={ledOn ? 1.2 : 0.95} />
      {/* 主方向光（模拟阳光） */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 6, -3]} intensity={0.5} color="#bee3f8" />
      {/* 半球光让暗部不至于死黑 */}
      <hemisphereLight args={["#dbeafe", "#65a30d", 0.7]} />

      {/* 大棚结构 */}
      <GreenhouseShell alert={alert} />

      {/* 作物 */}
      <CropField crop={crop} ledOn={ledOn} />

      {/* 3 排补光灯 */}
      <GrowLight position={[-1.6, 2.4, 0]} on={ledOn} />
      <GrowLight position={[0, 2.4, 0]} on={ledOn} />
      <GrowLight position={[1.6, 2.4, 0]} on={ledOn} />

      {/* 后墙风扇（z = -2 端面） */}
      <Fan position={[-1, 1.2, -2.05]} on={motorOn} />
      <Fan position={[1, 1.2, -2.05]} on={motorOn} />

      {/* 阴影增强真实感 */}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
    </>
  );
}

// ============================================================
// 头部状态条
// ============================================================
function HeaderBar({
  crop, connectionMode, ledOn, motorOn, hasAlert,
}: {
  crop: string;
  connectionMode: "live" | "waiting" | "offline";
  ledOn: boolean;
  motorOn: boolean;
  hasAlert: boolean;
}) {
  const connLabel = connectionMode === "live" ? "实时" : connectionMode === "waiting" ? "等待" : "离线";
  const connClass =
    connectionMode === "live"
      ? "bg-green-900/50 text-green-300 border-green-700"
      : connectionMode === "waiting"
      ? "bg-blue-900/50 text-blue-300 border-blue-700"
      : "bg-gray-800/80 text-gray-400 border-gray-600";
  const frameColor = hasAlert ? "#ef4444" : "#22c55e";

  return (
    <div
      className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-2 border-b"
      style={{ borderColor: `${frameColor}30`, background: "rgba(4,10,22,0.82)" }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="w-2 h-2 rounded-full bg-green-400 shrink-0"
          style={{ boxShadow: "0 0 6px #4ade80" }}
        />
        <span className="text-green-300 text-xs font-bold tracking-widest">3D 数字孪生</span>
        <span className="text-cyan-400 text-xs">·</span>
        <span className="text-cyan-300 text-xs font-semibold">{crop}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${connClass}`}>
          {connLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            ledOn
              ? "bg-yellow-900/50 border-yellow-600 text-yellow-300"
              : "bg-gray-800/80 border-gray-600 text-gray-500"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${ledOn ? "bg-yellow-400" : "bg-gray-600"}`} />
          补光灯 {ledOn ? "ON" : "OFF"}
        </span>
        <span
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            motorOn
              ? "bg-blue-900/50 border-blue-600 text-blue-300"
              : "bg-gray-800/80 border-gray-600 text-gray-500"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${motorOn ? "bg-blue-400" : "bg-gray-600"}`} />
          风扇 {motorOn ? "ON" : "OFF"}
        </span>
        {hasAlert && (
          <span className="bg-red-900/70 border border-red-500 text-red-300 text-xs px-3 py-0.5 rounded-full animate-pulse">
            ⚠ 环境异常
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 底部数据条
// ============================================================
function DataPanel({ sv }: { sv: Partial<Record<SensorKey, number>> }) {
  const items: { key: SensorKey; zh: string; unit: string }[] = [
    { key: "temp", zh: "气温", unit: "°C" },
    { key: "humidity", zh: "湿度", unit: "%" },
    { key: "light", zh: "光照", unit: "lux" },
    { key: "co2", zh: "CO₂", unit: "ppm" },
    { key: "soilHumidity", zh: "土壤湿", unit: "%" },
    { key: "soilTemp", zh: "土壤温", unit: "°C" },
  ];
  return (
    <div
      className="absolute left-0 right-0 bottom-0 z-10 flex items-stretch border-t divide-x"
      style={{ borderColor: "#22c55e33", background: "rgba(4,10,22,0.92)" }}
    >
      {items.map(({ key, zh, unit }) => {
        const v = sv[key];
        const ok = isOk(key, v);
        const color = statusColor(ok);
        const display =
          v !== undefined
            ? key === "light" || key === "co2"
              ? Math.round(v).toString()
              : v.toFixed(1)
            : "--";
        return (
          <div key={key} className="flex-1 flex flex-col items-center py-2 px-1 gap-0.5"
            style={{ borderColor: "#22c55e22" }}>
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
// 导出主组件
// ============================================================
export function GreenhouseDigitalTwin3D({ sensorValues, connectionMode, crop, ledOn, motorOn }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    // 强制定期 re-render 以让 HeaderBar 中 ON/OFF 文字与勾选效果同步
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const KEYS: SensorKey[] = ["temp", "humidity", "light", "co2", "soilHumidity", "soilTemp"];
  const allOks = KEYS.map((k) => isOk(k, sensorValues[k])).filter((v) => v !== null);
  const hasAlert = allOks.some((v) => v === false);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height: 560,
        background: "linear-gradient(160deg,#1e3a5f 0%,#3b6ea5 55%,#1e3a5f 100%)",
      }}
    >
      <HeaderBar
        crop={crop}
        connectionMode={connectionMode}
        ledOn={ledOn}
        motorOn={motorOn}
        hasAlert={hasAlert}
      />

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [4.5, 3.6, 5.5], fov: 45 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={<Html center><span style={{ color: "#22c55e" }}>加载 3D 场景中…</span></Html>}>
          <Scene crop={crop} ledOn={ledOn} motorOn={motorOn} alert={hasAlert} />
          <OrbitControls
            enablePan={false}
            minDistance={3.5}
            maxDistance={12}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 0.8, 0]}
          />
        </Suspense>
      </Canvas>

      <DataPanel sv={sensorValues} />

      {/* 操作提示 */}
      <div className="absolute right-3 top-12 text-[10px] text-gray-400 bg-black/40 rounded px-2 py-1 z-10 pointer-events-none">
        鼠标拖拽旋转 · 滚轮缩放
      </div>
    </div>
  );
}

// 兼容旧名称导出（避免改其它引用处）
export { GreenhouseDigitalTwin3D as GreenhouseDigitalTwin };
