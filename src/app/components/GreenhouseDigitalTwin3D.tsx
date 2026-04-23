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
  waterOn?: boolean;
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
function CropPlant({ position, fruitColor, leafColor, ledOn, crop }: {
  position: [number, number, number];
  fruitColor: string;
  leafColor: string;
  ledOn: boolean;
  crop: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // 让作物在补光时轻微"呼吸"
  useFrame((state) => {
    if (groupRef.current && ledOn) {
      const t = state.clock.elapsedTime;
      groupRef.current.scale.y = SCALE * (1 + Math.sin(t * 1.5 + position[0]) * 0.03);
    } else if (groupRef.current) {
      groupRef.current.scale.y = SCALE;
    }
  });

  // 与总览 FarmDigitalTwin3D.CropMini 保持一致的几何，这里以 SCALE 放大到聚焦视图尺寸
  const SCALE = 2.6;
  const fruit = fruitColor;
  const leaf = leafColor;

  const body = (() => {
    switch (crop) {
      // ── 番茄 ──
      case "番茄":
        return (
          <>
            <mesh position={[0, 0.11, 0]} castShadow>
              <cylinderGeometry args={[0.009, 0.014, 0.22, 6]} />
              <meshStandardMaterial color="#65a30d" roughness={0.9} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 + i * 0.3;
              const y = 0.06 + (i % 3) * 0.06;
              const r = 0.08 + (i % 2) * 0.015;
              return (
                <mesh key={`l${i}`} position={[Math.cos(a) * 0.05, y, Math.sin(a) * 0.05]} rotation={[Math.PI / 2 - 0.4, a, 0]} castShadow>
                  <coneGeometry args={[r * 0.55, r * 1.6, 5]} />
                  <meshStandardMaterial color={leaf} roughness={0.85} />
                </mesh>
              );
            })}
            {[
              [0.065, 0.14, 0.03, 0.036],
              [-0.055, 0.11, -0.045, 0.032],
              [0.02, 0.07, 0.06, 0.028],
            ].map(([fx, fy, fz, fr], i) => (
              <group key={`f${i}`} position={[fx, fy, fz]}>
                <mesh castShadow scale={[1, 0.88, 1]}>
                  <sphereGeometry args={[fr, 12, 10]} />
                  <meshStandardMaterial color={fruit} roughness={0.4} />
                </mesh>
                {[0, 1, 2, 3, 4].map((k) => {
                  const ang = (k / 5) * Math.PI * 2;
                  return (
                    <mesh key={k} position={[Math.cos(ang) * fr * 0.6, fr * 0.72, Math.sin(ang) * fr * 0.6]} rotation={[Math.PI / 2 - 0.7, ang, 0]}>
                      <coneGeometry args={[fr * 0.22, fr * 0.55, 4]} />
                      <meshStandardMaterial color="#15803d" />
                    </mesh>
                  );
                })}
              </group>
            ))}
          </>
        );

      // ── 黄瓜 ──
      case "黄瓜":
        return (
          <>
            <mesh position={[0, 0.15, 0]} castShadow>
              <cylinderGeometry args={[0.006, 0.008, 0.3, 6]} />
              <meshStandardMaterial color="#92400e" />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2 + i * 0.5;
              const y = 0.09 + i * 0.05;
              return (
                <mesh key={`l${i}`} position={[Math.cos(a) * 0.02, y, Math.sin(a) * 0.02]} rotation={[-Math.PI / 6, a, 0]} castShadow scale={[1.4, 0.1, 1.4]}>
                  <sphereGeometry args={[0.065, 10, 6]} />
                  <meshStandardMaterial color={leaf} roughness={0.85} side={THREE.DoubleSide} />
                </mesh>
              );
            })}
            {[
              [0.05, 0.12, 0, Math.PI / 2.2, 0.022, 2.8],
              [-0.04, 0.09, 0.035, -Math.PI / 2.6, 0.019, 2.5],
            ].map(([cx, cy, cz, rz, rr, len], i) => (
              <mesh key={`c${i}`} position={[cx, cy, cz]} rotation={[0, 0, rz]} castShadow scale={[1, len, 1]}>
                <capsuleGeometry args={[rr, rr * 0.8, 4, 10]} />
                <meshStandardMaterial color={fruit} roughness={0.75} />
              </mesh>
            ))}
            <mesh position={[0.02, 0.18, -0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <coneGeometry args={[0.018, 0.025, 6]} />
              <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.15} />
            </mesh>
          </>
        );

      // ── 草莓 ──
      case "草莓":
        return (
          <>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              const cx = Math.cos(a) * 0.055;
              const cz = Math.sin(a) * 0.055;
              return (
                <group key={`rosette${i}`} position={[cx, 0.035, cz]} rotation={[0, a, 0]}>
                  {[-0.3, 0, 0.3].map((offset, k) => (
                    <mesh key={k} position={[0, 0.01, 0.02 + Math.abs(offset) * 0.01]} rotation={[Math.PI / 2.6, offset, 0]} castShadow scale={[0.9, 0.12, 1]}>
                      <sphereGeometry args={[0.028, 8, 6]} />
                      <meshStandardMaterial color={leaf} roughness={0.85} side={THREE.DoubleSide} />
                    </mesh>
                  ))}
                </group>
              );
            })}
            {[
              [0.045, 0.04, 0, 0.028],
              [-0.035, 0.04, 0.045, 0.024],
            ].map(([fx, fy, fz, fr], i) => (
              <group key={`berry${i}`} position={[fx, fy, fz]}>
                <mesh rotation={[Math.PI, 0, 0]} castShadow>
                  <coneGeometry args={[fr, fr * 2.0, 10]} />
                  <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.1} roughness={0.45} />
                </mesh>
                {[0, 1, 2, 3, 4].map((k) => {
                  const ang = (k / 5) * Math.PI * 2;
                  return (
                    <mesh key={k} position={[Math.cos(ang) * fr * 0.7, fr * 1.0, Math.sin(ang) * fr * 0.7]} rotation={[Math.PI / 2 - 0.5, ang, 0]}>
                      <coneGeometry args={[fr * 0.25, fr * 0.6, 4]} />
                      <meshStandardMaterial color="#15803d" />
                    </mesh>
                  );
                })}
              </group>
            ))}
            <mesh position={[0.02, 0.07, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <sphereGeometry args={[0.014, 8, 6]} />
              <meshStandardMaterial color="#fef2f2" emissive="#fecaca" emissiveIntensity={0.2} />
            </mesh>
          </>
        );

      // ── 辣椒 ──
      case "辣椒":
        return (
          <>
            <mesh position={[0, 0.09, 0]} castShadow>
              <cylinderGeometry args={[0.010, 0.013, 0.18, 6]} />
              <meshStandardMaterial color="#65a30d" roughness={0.9} />
            </mesh>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const a = (i / 7) * Math.PI * 2 + i * 0.2;
              const y = 0.07 + (i % 3) * 0.04;
              return (
                <mesh key={`l${i}`} position={[Math.cos(a) * 0.045, y, Math.sin(a) * 0.045]} rotation={[Math.PI / 2.5, a, 0]} castShadow scale={[0.7, 0.15, 1.3]}>
                  <sphereGeometry args={[0.04, 8, 6]} />
                  <meshStandardMaterial color={leaf} roughness={0.85} />
                </mesh>
              );
            })}
            {[
              [0.045, 0.13, 0.01, Math.PI - 0.15, 0.017, 3.2],
              [-0.04, 0.12, 0.03, Math.PI + 0.2, 0.015, 3.0],
              [0.015, 0.11, -0.05, Math.PI, 0.014, 2.8],
            ].map(([cx, cy, cz, rx, rr, len], i) => (
              <group key={`p${i}`} position={[cx, cy, cz]}>
                <mesh rotation={[rx, 0, (i - 1) * 0.1]} castShadow scale={[1, len, 1]}>
                  <coneGeometry args={[rr, rr * 2.5, 8]} />
                  <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.15} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.005, 0]}>
                  <cylinderGeometry args={[rr * 0.7, rr * 0.9, rr * 0.8, 6]} />
                  <meshStandardMaterial color="#15803d" />
                </mesh>
              </group>
            ))}
          </>
        );

      // ── 生菜 ──
      case "生菜":
        return (
          <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <mesh key={`o${i}`} position={[Math.cos(a) * 0.055, 0.04, Math.sin(a) * 0.055]} rotation={[Math.PI / 2.2, a, 0.2]} castShadow scale={[1.2, 0.18, 1.35]}>
                  <sphereGeometry args={[0.055, 10, 6]} />
                  <meshStandardMaterial color={leaf} roughness={0.85} side={THREE.DoubleSide} />
                </mesh>
              );
            })}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 + 0.3;
              return (
                <mesh key={`i${i}`} position={[Math.cos(a) * 0.03, 0.07, Math.sin(a) * 0.03]} rotation={[Math.PI / 3, a, 0]} castShadow scale={[0.9, 0.16, 1.1]}>
                  <sphereGeometry args={[0.038, 10, 6]} />
                  <meshStandardMaterial color={fruit} roughness={0.8} side={THREE.DoubleSide} />
                </mesh>
              );
            })}
            <mesh position={[0, 0.08, 0]} castShadow>
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshStandardMaterial color={fruit} roughness={0.9} />
            </mesh>
          </>
        );

      // ── 茄子 ──
      case "茄子":
        return (
          <>
            <mesh position={[0, 0.10, 0]} castShadow>
              <cylinderGeometry args={[0.013, 0.017, 0.2, 6]} />
              <meshStandardMaterial color="#4d7c0f" roughness={0.9} />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2;
              const y = 0.11 + (i % 2) * 0.04;
              return (
                <mesh key={`l${i}`} position={[Math.cos(a) * 0.05, y, Math.sin(a) * 0.05]} rotation={[Math.PI / 2.8, a, 0]} castShadow scale={[1.25, 0.12, 1.4]}>
                  <sphereGeometry args={[0.055, 10, 6]} />
                  <meshStandardMaterial color="#166534" roughness={0.85} side={THREE.DoubleSide} />
                </mesh>
              );
            })}
            {[
              [0.06, 0.10, 0.01, Math.PI / 8, 0.026, 2.3],
              [-0.05, 0.09, 0.04, -Math.PI / 9, 0.024, 2.1],
            ].map(([cx, cy, cz, rz, rr, len], i) => (
              <group key={`e${i}`} position={[cx, cy, cz]} rotation={[0, 0, rz]}>
                <mesh castShadow scale={[1, len, 1]}>
                  <capsuleGeometry args={[rr, rr * 1.5, 4, 12]} />
                  <meshStandardMaterial color={fruit} roughness={0.3} metalness={0.1} emissive="#4c1d95" emissiveIntensity={0.1} />
                </mesh>
                <mesh position={[0, rr * len * 0.75, 0]} castShadow>
                  <coneGeometry args={[rr * 1.15, rr * 0.9, 6]} />
                  <meshStandardMaterial color="#166534" roughness={0.8} />
                </mesh>
                <mesh position={[0, rr * len * 1.05, 0]}>
                  <cylinderGeometry args={[rr * 0.2, rr * 0.3, rr * 0.6, 6]} />
                  <meshStandardMaterial color="#4d7c0f" />
                </mesh>
              </group>
            ))}
          </>
        );

      default:
        return (
          <mesh castShadow>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={leaf} />
          </mesh>
        );
    }
  })();

  return (
    <group ref={groupRef} position={position} scale={SCALE}>
      {body}
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
// 水泵电机 — 浇水或风扇启动时都会转动(MOTOR_CONTROL 公用硬件)
// 表现形式:外壳 + 顶部转轴 + 转子 + 工作指示灯
// ============================================================
function WaterPump({ position, on }: { position: [number, number, number]; on: boolean }) {
  const rotorRef = useRef<THREE.Mesh>(null);
  const speedRef = useRef(0);
  useFrame((_, delta) => {
    const target = on ? 16 : 0;
    speedRef.current += (target - speedRef.current) * Math.min(1, delta * 5);
    if (rotorRef.current) rotorRef.current.rotation.y += speedRef.current * delta;
  });
  return (
    <group position={position}>
      {/* 底座 */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.6, 0.1, 0.5]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* 主体外壳(圆筒电机) */}
      <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 24]} />
        <meshStandardMaterial color={on ? "#0ea5e9" : "#475569"} metalness={0.7} roughness={0.35} emissive={on ? "#0284c7" : "#000000"} emissiveIntensity={on ? 0.25 : 0} />
      </mesh>
      {/* 散热片 */}
      {[-0.18, -0.06, 0.06, 0.18].map((dx) => (
        <mesh key={dx} position={[dx, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.19, 0.19, 0.02, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.5} />
        </mesh>
      ))}
      {/* 转轴 + 转子 (露在端面) */}
      <mesh position={[-0.3, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} />
      </mesh>
      <mesh ref={rotorRef} position={[-0.36, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.025, 8, 24]} />
        <meshStandardMaterial color={on ? "#22c55e" : "#374151"} metalness={0.7} emissive={on ? "#16a34a" : "#000000"} emissiveIntensity={on ? 0.6 : 0} />
      </mesh>
      {/* 接水管 (向上接到喷淋系统) */}
      <mesh position={[0.05, 0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 10]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} />
      </mesh>
      {/* 工作指示灯 */}
      <mesh position={[0.18, 0.45, 0.21]}>
        <sphereGeometry args={[0.028, 8, 8]} />
        <meshStandardMaterial color={on ? "#22c55e" : "#7f1d1d"} emissive={on ? "#22c55e" : "#7f1d1d"} emissiveIntensity={on ? 1.5 : 0.2} />
      </mesh>
      {/* 标签 "MOTOR" 用 Html 替代太重,直接用一个浅色小标签矩形 */}
      <mesh position={[0, 0.3, 0.181]}>
        <planeGeometry args={[0.18, 0.06]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
    </group>
  );
}
// ============================================================
function Sprinkler({ position, on }: { position: [number, number, number]; on: boolean }) {
  // 24 个粒子,从喷头辐射展开向下喷洒(放大版水柱)
  const particlesRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!particlesRef.current) return;
    particlesRef.current.children.forEach((child, i) => {
      if (!on) {
        child.position.y = 0;
        child.scale.setScalar(0);
        return;
      }
      child.scale.setScalar(1);
      child.position.y -= delta * 2.2;
      // 周期重置
      const cycleOffset = (i * 0.13) % 1.0;
      if (child.position.y < -1.6) {
        child.position.y = 0 - cycleOffset * 0.08;
      }
    });
  });

  return (
    <group position={position}>
      {/* 喷头主体 */}
      <mesh castShadow>
        <cylinderGeometry args={[0.08, 0.11, 0.16, 12]} />
        <meshStandardMaterial
          color={on ? "#0ea5e9" : "#475569"}
          metalness={0.6}
          roughness={0.4}
          emissive={on ? "#0ea5e9" : "#000000"}
          emissiveIntensity={on ? 0.5 : 0}
        />
      </mesh>
      {/* 喷头底盘 */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.13, 0.08, 0.05, 12]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} />
      </mesh>
      {/* 喷水粒子(放大版蓝色水滴) */}
      <group ref={particlesRef}>
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          // 三层环形分布,半径更大
          const layer = i % 3;
          const r = 0.08 + layer * 0.12;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r, -i * 0.04, Math.sin(a) * r]}
              scale={on ? 1 : 0}
            >
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshStandardMaterial
                color="#60a5fa"
                transparent
                opacity={0.9}
                emissive="#3b82f6"
                emissiveIntensity={0.6}
              />
            </mesh>
          );
        })}
      </group>
      {/* 工作指示灯 */}
      {on && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.8} />
        </mesh>
      )}
      {/* 地面湿润光晕(更大) */}
      {on && (
        <mesh position={[0, -1.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.3, 32]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} toneMapped={false} />
        </mesh>
      )}
      {/* 内圈深色湿土 */}
      {on && (
        <mesh position={[0, -1.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.7, 24]} />
          <meshBasicMaterial color="#1e40af" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

// ============================================================
// 落雨效果 — 浇水时整个大棚内随机下落雨滴 + 地面涟漪
// ============================================================
function RainField({ on }: { on: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  // 80 颗雨滴,均匀撒在大棚内体积上空,每颗有自己的下落速度与初始 y
  const drops = useMemo(() => {
    return Array.from({ length: 80 }).map(() => ({
      x: (Math.random() - 0.5) * 4.6,        // 棚宽 5
      z: (Math.random() - 0.5) * 5.0,        // 棚长 5.4
      y: Math.random() * 2.4 + 0.2,          // 起始 0.2 ~ 2.6
      speed: 3.5 + Math.random() * 2.5,      // 下落速度 3.5 ~ 6
    }));
  }, []);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      if (!on) {
        child.scale.setScalar(0);
        return;
      }
      child.scale.setScalar(1);
      const d = drops[i];
      child.position.y -= delta * d.speed;
      // 触地后回到棚顶,稍微随机化 x/z 防止周期感
      if (child.position.y < -1.45) {
        child.position.x = (Math.random() - 0.5) * 4.6;
        child.position.z = (Math.random() - 0.5) * 5.0;
        child.position.y = 2.4 + Math.random() * 0.4;
      }
    });
  });
  // 涟漪环 — 6 个固定位置周期性放大淡出
  const ripplesRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ripplesRef.current) return;
    const t = state.clock.elapsedTime;
    ripplesRef.current.children.forEach((c, i) => {
      if (!on) {
        c.scale.setScalar(0);
        return;
      }
      const phase = (t * 1.4 + i * 0.35) % 1.5;
      const s = 0.1 + phase * 0.9;
      c.scale.set(s, s, s);
      const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.55 - phase * 0.4);
    });
  });
  if (!on) {
    return (
      <>
        <group ref={groupRef}>
          {drops.map((_, i) => (
            <mesh key={i} scale={0}><sphereGeometry args={[0.02, 4, 4]} /><meshBasicMaterial color="#bae6fd" /></mesh>
          ))}
        </group>
        <group ref={ripplesRef}>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={i} scale={0}><ringGeometry args={[0.18, 0.22, 16]} /><meshBasicMaterial color="#60a5fa" transparent opacity={0} /></mesh>
          ))}
        </group>
      </>
    );
  }
  return (
    <>
      {/* 雨滴 — 细长拉伸的水柱 */}
      <group ref={groupRef}>
        {drops.map((d, i) => (
          <mesh key={i} position={[d.x, d.y, d.z]} scale={[1, 4, 1]}>
            <sphereGeometry args={[0.025, 4, 4]} />
            <meshStandardMaterial
              color="#bae6fd"
              transparent
              opacity={0.7}
              emissive="#60a5fa"
              emissiveIntensity={0.5}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      {/* 地面涟漪 */}
      <group ref={ripplesRef}>
        {[
          [-1.6, -1.44, -1.5], [1.6, -1.44, -1.0], [0, -1.44, 1.2],
          [-1.6, -1.44, 1.5], [1.6, -1.44, 1.6], [0, -1.44, -1.8],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.6, 24]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* 棚内蓝色雾感(整体偏冷) */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[5, 3.5, 5.4]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.04} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

// ============================================================
// 大棚结构（地面 + 植床 + 玻璃罩）
// ============================================================
function GreenhouseShell({ alert }: { alert: boolean }) {
  const glassColor = alert ? "#7f1d1d" : "#3b82f6";
  const R = 2.7;
  const W = 5.4;
  return (
    <group>
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[14, 9]} />
        <meshStandardMaterial color="#3f2a1a" roughness={0.9} />
      </mesh>
      {/* 植床（3 列） */}
      {[-1.6, 0, 1.6].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.75, 0.1, W - 0.4]} />
          <meshStandardMaterial color="#5a2f17" roughness={0.85} />
        </mesh>
      ))}
      {/* 玻璃外罩 - 拱形顶（半圆柱体）平边贴地,弧顶在上 */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, W, 32, 1, true, 0, Math.PI]} />
        <meshPhysicalMaterial
          color={glassColor}
          transparent
          opacity={0.18}
          roughness={0.05}
          transmission={0.75}
          thickness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 前后山墙 */}
      {[-W / 2, W / 2].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <circleGeometry args={[R, 32, 0, Math.PI]} />
          <meshPhysicalMaterial
            color={glassColor}
            transparent
            opacity={0.22}
            roughness={0.05}
            transmission={0.85}
            thickness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* 框架钢梁 - 拱筋 */}
      {[-W / 2, -W / 4, 0, W / 4, W / 2].map((z) => (
        <group key={z} position={[0, 0, z]}>
          {Array.from({ length: 16 }).map((_, i) => {
            const a1 = (i / 16) * Math.PI;
            const a2 = ((i + 1) / 16) * Math.PI;
            const x1 = Math.cos(a1) * R;
            const y1 = Math.sin(a1) * R;
            const x2 = Math.cos(a2) * R;
            const y2 = Math.sin(a2) * R;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const len = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            return (
              <mesh key={i} position={[mx, my, 0]} rotation={[0, 0, angle]}>
                <boxGeometry args={[len, 0.05, 0.05]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.4} />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* 地基底框 */}
      {[-W / 2, W / 2].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[2 * R - 0.2, 0.1, 0.1]} />
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
      for (let z = -2.2; z <= 2.2; z += 0.55) {
        arr.push([x, 0.1, z]);
      }
    });
    return arr;
  }, []);
  return (
    <>
      {positions.map((p, i) => (
        <CropPlant key={i} position={p} fruitColor={fruit} leafColor={leaf} ledOn={ledOn} crop={crop} />
      ))}
    </>
  );
}

// ============================================================
// 主场景（在 Canvas 内）
// ============================================================
function Scene({
  crop, ledOn, motorOn, waterOn, alert,
}: {
  crop: string;
  ledOn: boolean;
  motorOn: boolean;
  waterOn: boolean;
  alert: boolean;
}) {
  return (
    <>
      {/* 环境光 — 整体增亮 */}
      <ambientLight intensity={ledOn ? 1.6 : 1.3} />
      {/* 主方向光（模拟阳光） */}
      <directionalLight
        position={[5, 10, 6]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 8, -3]} intensity={0.9} color="#bee3f8" />
      <directionalLight position={[0, 6, -6]} intensity={0.6} color="#fef3c7" />
      {/* 半球光让暗部不至于死黑 */}
      <hemisphereLight args={["#dbeafe", "#65a30d", 1.0]} />

      {/* 大棚结构 */}
      <GreenhouseShell alert={alert} />

      {/* 作物 */}
      <CropField crop={crop} ledOn={ledOn} />

      {/* 3 排补光灯 */}
      <GrowLight position={[-1.6, 1.8, 0]} on={ledOn} />
      <GrowLight position={[0, 2.3, 0]} on={ledOn} />
      <GrowLight position={[1.6, 1.8, 0]} on={ledOn} />

      {/* 后墙风扇（z = -W/2 端面） — 仅响应风扇电机指令(motorOn) */}
      <Fan position={[-1.2, 1.1, -2.75]} on={motorOn} />
      <Fan position={[1.2, 1.1, -2.75]} on={motorOn} />

      {/* 水泵电机(位于棚一侧地面) — 仅响应浇水指令(waterOn),与风扇视觉独立 */}
      {/* 注: 真实硬件中水泵与风扇共用同一个电机, 这里在虚拟场景中分别显示为两个独立设备 */}
      <WaterPump position={[2.0, -1.35, 2.3]} on={waterOn} />

      {/* 喷淋装置（顶部 3 个,均匀分布在棚长方向） */}
      <Sprinkler position={[0, 1.95, -1.6]} on={waterOn} />
      <Sprinkler position={[0, 1.95, 0]} on={waterOn} />
      <Sprinkler position={[0, 1.95, 1.6]} on={waterOn} />

      {/* 棚内落雨效果 */}
      <RainField on={waterOn} />

      {/* 阴影增强真实感 */}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={12} blur={2.5} far={4} />
    </>
  );
}

// ============================================================
// 头部状态条
// ============================================================
function HeaderBar({
  crop, connectionMode, ledOn, motorOn, waterOn, hasAlert,
}: {
  crop: string;
  connectionMode: "live" | "waiting" | "offline";
  ledOn: boolean;
  motorOn: boolean;
  waterOn: boolean;
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
        <span
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            waterOn
              ? "bg-cyan-900/50 border-cyan-600 text-cyan-300"
              : "bg-gray-800/80 border-gray-600 text-gray-500"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${waterOn ? "bg-cyan-400" : "bg-gray-600"}`} />
          浇水 {waterOn ? "ON" : "OFF"}
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
export function GreenhouseDigitalTwin3D({ sensorValues, connectionMode, crop, ledOn, motorOn, waterOn = false }: Props) {
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
        background: "linear-gradient(160deg,#3b6ea5 0%,#60a5fa 55%,#3b6ea5 100%)",
      }}
    >
      <HeaderBar
        crop={crop}
        connectionMode={connectionMode}
        ledOn={ledOn}
        motorOn={motorOn}
        waterOn={waterOn}
        hasAlert={hasAlert}
      />

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [7, 5.5, 8.5], fov: 45 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={<Html center><span style={{ color: "#22c55e" }}>加载 3D 场景中…</span></Html>}>
          <Scene crop={crop} ledOn={ledOn} motorOn={motorOn} waterOn={waterOn} alert={hasAlert} />
          <OrbitControls
            enablePan={false}
            minDistance={4}
            maxDistance={14}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 1.4, 0]}
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
