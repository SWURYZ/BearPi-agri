/**
 * 3D Farm Digital Twin — 一块土地上的 6 个大棚总览
 *
 * - 单卡片，6 个大棚按 2×3 排列在同一片土地上
 * - 每个大棚可点击 → 触发 onSelect(name) 进入详情
 * - 鼠标悬浮高亮，名字浮空显示
 * - 状态指示：补光灯亮 → 灯泡发黄光；风扇开 → 蓝色风扇标识旋转
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const CROP_PAL: Record<string, [string, string]> = {
  "番茄": ["#ef4444", "#16a34a"],
  "黄瓜": ["#84cc16", "#15803d"],
  "草莓": ["#f43f5e", "#15803d"],
  "辣椒": ["#dc2626", "#15803d"],
  "生菜": ["#4ade80", "#166534"],
  "茄子": ["#7c3aed", "#15803d"],
};

/** 基于 (x,z) 的稳定伪随机，避免同种作物排成"复印件" */
function seeded(x: number, z: number, salt = 0): number {
  const s = Math.sin((x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453);
  return s - Math.floor(s);
}

export type ConnMode = "live" | "waiting" | "offline";

export interface FarmGreenhouse {
  name: string;
  crop: string;
  ledOn: boolean;
  motorOn: boolean;
  /** 虚拟浇水开关，未传入时默认跟随 motorOn */
  waterOn?: boolean;
  connectionMode: ConnMode;
  hasAlert?: boolean;
}

interface Props {
  greenhouses: FarmGreenhouse[];
  onSelect: (name: string) => void;
}

// ============================================================
// 单株作物迷你模型（按作物类型生成不同造型）
// 设计原则：
//   · 果实 → 真实颜色 + 形态（番茄球、辣椒下垂锥、草莓心、黄瓜长条、茄子长椭、生菜叶球）
//   · 花萼/叶柄：番茄/草莓/茄子顶部有小绿色萼片
//   · 叶序：由多片独立叶子按角度排布，而不是一个大球
//   · 差异化：按位置 seed 给每株加少量随机偏移/旋转/缩放，避免整齐得像复印件
// ============================================================
function CropMini({ crop, position }: { crop: string; position: [number, number, number] }) {
  const [fruit, leaf] = CROP_PAL[crop] ?? CROP_PAL["番茄"];
  const [px, , pz] = position;
  // 每株独立的小随机：旋转 / 缩放 / 位置抖动，保留整体一致性
  const rot = (seeded(px, pz, 1) - 0.5) * 0.9;                     // ±0.45 rad yaw
  const scl = 0.92 + seeded(px, pz, 2) * 0.18;                     // 0.92~1.10
  const jog = (k: number) => (seeded(px, pz, k) - 0.5) * 0.02;     // ±1cm 抖动

  const baseGroupProps = {
    position: [position[0] + jog(3), position[1], position[2] + jog(4)] as [number, number, number],
    rotation: [0, rot, 0] as [number, number, number],
    scale: scl,
  };

  switch (crop) {
    // ── 番茄：细直茎 + 复叶（多片小叶）+ 红果带绿萼 ──
    case "番茄":
      return (
        <group {...baseGroupProps}>
          {/* 主茎 */}
          <mesh position={[0, 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.009, 0.014, 0.22, 6]} />
            <meshStandardMaterial color="#65a30d" roughness={0.9} />
          </mesh>
          {/* 分支叶（6 片羽状叶团，沿茎错落分布） */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2 + i * 0.3;
            const y = 0.06 + (i % 3) * 0.06;
            const r = 0.08 + (i % 2) * 0.015;
            return (
              <mesh
                key={`l${i}`}
                position={[Math.cos(a) * 0.05, y, Math.sin(a) * 0.05]}
                rotation={[Math.PI / 2 - 0.4, a, 0]}
                castShadow
              >
                <coneGeometry args={[r * 0.55, r * 1.6, 5]} />
                <meshStandardMaterial color={leaf} roughness={0.85} />
              </mesh>
            );
          })}
          {/* 3 颗番茄果 + 绿萼 */}
          {[
            [0.065, 0.14, 0.03, 0.036],
            [-0.055, 0.11, -0.045, 0.032],
            [0.02, 0.07, 0.06, 0.028],
          ].map(([fx, fy, fz, fr], i) => (
            <group key={`f${i}`} position={[fx, fy, fz]}>
              {/* 略扁的番茄球（顶部缩放 0.88 更像真实番茄） */}
              <mesh castShadow scale={[1, 0.88, 1]}>
                <sphereGeometry args={[fr, 12, 10]} />
                <meshStandardMaterial color={fruit} roughness={0.4} />
              </mesh>
              {/* 绿色萼片（5 瓣星形） */}
              {[0, 1, 2, 3, 4].map((k) => {
                const ang = (k / 5) * Math.PI * 2;
                return (
                  <mesh
                    key={k}
                    position={[Math.cos(ang) * fr * 0.6, fr * 0.72, Math.sin(ang) * fr * 0.6]}
                    rotation={[Math.PI / 2 - 0.7, ang, 0]}
                  >
                    <coneGeometry args={[fr * 0.22, fr * 0.55, 4]} />
                    <meshStandardMaterial color="#15803d" />
                  </mesh>
                );
              })}
            </group>
          ))}
        </group>
      );

    // ── 黄瓜：立杆 + 宽心形叶 + 下垂长条果 + 黄色雌花 ──
    case "黄瓜":
      return (
        <group {...baseGroupProps}>
          {/* 支架竹杆 */}
          <mesh position={[0, 0.15, 0]} castShadow>
            <cylinderGeometry args={[0.006, 0.008, 0.3, 6]} />
            <meshStandardMaterial color="#92400e" />
          </mesh>
          {/* 宽心形叶（4-5 片沿杆螺旋分布） */}
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2 + i * 0.5;
            const y = 0.09 + i * 0.05;
            return (
              <mesh
                key={`l${i}`}
                position={[Math.cos(a) * 0.02, y, Math.sin(a) * 0.02]}
                rotation={[-Math.PI / 6, a, 0]}
                castShadow
                scale={[1.4, 0.1, 1.4]}
              >
                <sphereGeometry args={[0.065, 10, 6]} />
                <meshStandardMaterial color={leaf} roughness={0.85} side={THREE.DoubleSide} />
              </mesh>
            );
          })}
          {/* 2 根下垂黄瓜（细长 + 略弯 + 表面凸起纹理感用 roughness 近似） */}
          {[
            [0.05, 0.12, 0, Math.PI / 2.2, 0.022, 2.8],
            [-0.04, 0.09, 0.035, -Math.PI / 2.6, 0.019, 2.5],
          ].map(([cx, cy, cz, rz, rr, len], i) => (
            <mesh
              key={`c${i}`}
              position={[cx, cy, cz]}
              rotation={[0, 0, rz]}
              castShadow
              scale={[1, len, 1]}
            >
              <capsuleGeometry args={[rr, rr * 0.8, 4, 10]} />
              <meshStandardMaterial color={fruit} roughness={0.75} />
            </mesh>
          ))}
          {/* 雌花黄色小花（黄瓜特征之一） */}
          <mesh position={[0.02, 0.18, -0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.018, 0.025, 6]} />
            <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.15} />
          </mesh>
        </group>
      );

    // ── 草莓：低矮三出复叶莲座 + 心形果带绿萼 + 白色小花 ──
    case "草莓":
      return (
        <group {...baseGroupProps}>
          {/* 三出复叶（6 组，每组 3 小叶，构成莲座） */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            const cx = Math.cos(a) * 0.055;
            const cz = Math.sin(a) * 0.055;
            return (
              <group key={`rosette${i}`} position={[cx, 0.035, cz]} rotation={[0, a, 0]}>
                {[-0.3, 0, 0.3].map((offset, k) => (
                  <mesh
                    key={k}
                    position={[0, 0.01, 0.02 + Math.abs(offset) * 0.01]}
                    rotation={[Math.PI / 2.6, offset, 0]}
                    castShadow
                    scale={[0.9, 0.12, 1]}
                  >
                    <sphereGeometry args={[0.028, 8, 6]} />
                    <meshStandardMaterial color={leaf} roughness={0.85} side={THREE.DoubleSide} />
                  </mesh>
                ))}
              </group>
            );
          })}
          {/* 2 颗草莓果（心形：用倒圆锥 + 顶部绿色萼片） */}
          {[
            [0.045, 0.04, 0, 1, 0.028],
            [-0.035, 0.04, 0.045, 1, 0.024],
          ].map(([fx, fy, fz, , fr], i) => (
            <group key={`berry${i}`} position={[fx, fy, fz]}>
              {/* 果实：倒立锥（尖端朝下），略圆润 */}
              <mesh rotation={[Math.PI, 0, 0]} castShadow>
                <coneGeometry args={[fr, fr * 2.0, 10]} />
                <meshStandardMaterial
                  color={fruit}
                  emissive={fruit}
                  emissiveIntensity={0.1}
                  roughness={0.45}
                />
              </mesh>
              {/* 顶部绿色萼片（星形 5 瓣） */}
              {[0, 1, 2, 3, 4].map((k) => {
                const ang = (k / 5) * Math.PI * 2;
                return (
                  <mesh
                    key={k}
                    position={[Math.cos(ang) * fr * 0.7, fr * 1.0, Math.sin(ang) * fr * 0.7]}
                    rotation={[Math.PI / 2 - 0.5, ang, 0]}
                  >
                    <coneGeometry args={[fr * 0.25, fr * 0.6, 4]} />
                    <meshStandardMaterial color="#15803d" />
                  </mesh>
                );
              })}
            </group>
          ))}
          {/* 一朵白色小花 */}
          <mesh position={[0.02, 0.07, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[0.014, 8, 6]} />
            <meshStandardMaterial color="#fef2f2" emissive="#fecaca" emissiveIntensity={0.2} />
          </mesh>
        </group>
      );

    // ── 辣椒：丛状多叶 + 3 根下垂尖锥红椒 ──
    case "辣椒":
      return (
        <group {...baseGroupProps}>
          {/* 主茎 */}
          <mesh position={[0, 0.09, 0]} castShadow>
            <cylinderGeometry args={[0.010, 0.013, 0.18, 6]} />
            <meshStandardMaterial color="#65a30d" roughness={0.9} />
          </mesh>
          {/* 深绿色椭圆叶（7 片分布） */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const a = (i / 7) * Math.PI * 2 + i * 0.2;
            const y = 0.07 + (i % 3) * 0.04;
            return (
              <mesh
                key={`l${i}`}
                position={[Math.cos(a) * 0.045, y, Math.sin(a) * 0.045]}
                rotation={[Math.PI / 2.5, a, 0]}
                castShadow
                scale={[0.7, 0.15, 1.3]}
              >
                <sphereGeometry args={[0.04, 8, 6]} />
                <meshStandardMaterial color={leaf} roughness={0.85} />
              </mesh>
            );
          })}
          {/* 3 根下垂尖辣椒（锥形 + 向下 + 略微弯曲） */}
          {[
            [0.045, 0.13, 0.01, Math.PI - 0.15, 0.017, 3.2],
            [-0.04, 0.12, 0.03, Math.PI + 0.2, 0.015, 3.0],
            [0.015, 0.11, -0.05, Math.PI, 0.014, 2.8],
          ].map(([cx, cy, cz, rx, rr, len], i) => (
            <group key={`p${i}`} position={[cx, cy, cz]}>
              {/* 辣椒果 */}
              <mesh rotation={[rx, 0, (i - 1) * 0.1]} castShadow scale={[1, len, 1]}>
                <coneGeometry args={[rr, rr * 2.5, 8]} />
                <meshStandardMaterial
                  color={fruit}
                  emissive={fruit}
                  emissiveIntensity={0.15}
                  roughness={0.35}
                />
              </mesh>
              {/* 绿色蒂把 */}
              <mesh position={[0, 0.005, 0]}>
                <cylinderGeometry args={[rr * 0.7, rr * 0.9, rr * 0.8, 6]} />
                <meshStandardMaterial color="#15803d" />
              </mesh>
            </group>
          ))}
        </group>
      );

    // ── 生菜：矮莲座卷叶球（多片弧形叶片交叠） ──
    case "生菜":
      return (
        <group {...baseGroupProps}>
          {/* 外圈大叶（8 片，波浪状半开） */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh
                key={`o${i}`}
                position={[Math.cos(a) * 0.055, 0.04, Math.sin(a) * 0.055]}
                rotation={[Math.PI / 2.2, a, 0.2]}
                castShadow
                scale={[1.2, 0.18, 1.35]}
              >
                <sphereGeometry args={[0.055, 10, 6]} />
                <meshStandardMaterial
                  color={leaf}
                  roughness={0.85}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
          {/* 内圈嫩叶（6 片，更浅色） */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2 + 0.3;
            return (
              <mesh
                key={`i${i}`}
                position={[Math.cos(a) * 0.03, 0.07, Math.sin(a) * 0.03]}
                rotation={[Math.PI / 3, a, 0]}
                castShadow
                scale={[0.9, 0.16, 1.1]}
              >
                <sphereGeometry args={[0.038, 10, 6]} />
                <meshStandardMaterial color={fruit} roughness={0.8} side={THREE.DoubleSide} />
              </mesh>
            );
          })}
          {/* 叶球芯 */}
          <mesh position={[0, 0.08, 0]} castShadow>
            <sphereGeometry args={[0.028, 10, 8]} />
            <meshStandardMaterial color={fruit} roughness={0.9} />
          </mesh>
        </group>
      );

    // ── 茄子：粗壮茎 + 大裂叶 + 下垂紫色长椭圆果（带绿色萼片） ──
    case "茄子":
      return (
        <group {...baseGroupProps}>
          {/* 主茎 */}
          <mesh position={[0, 0.10, 0]} castShadow>
            <cylinderGeometry args={[0.013, 0.017, 0.2, 6]} />
            <meshStandardMaterial color="#4d7c0f" roughness={0.9} />
          </mesh>
          {/* 大裂叶（5 片，深绿略带紫色调） */}
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            const y = 0.11 + (i % 2) * 0.04;
            return (
              <mesh
                key={`l${i}`}
                position={[Math.cos(a) * 0.05, y, Math.sin(a) * 0.05]}
                rotation={[Math.PI / 2.8, a, 0]}
                castShadow
                scale={[1.25, 0.12, 1.4]}
              >
                <sphereGeometry args={[0.055, 10, 6]} />
                <meshStandardMaterial color="#166534" roughness={0.85} side={THREE.DoubleSide} />
              </mesh>
            );
          })}
          {/* 2 根下垂紫色茄子（长椭圆 + 顶端绿萼） */}
          {[
            [0.06, 0.10, 0.01, Math.PI / 8, 0.026, 2.3],
            [-0.05, 0.09, 0.04, -Math.PI / 9, 0.024, 2.1],
          ].map(([cx, cy, cz, rz, rr, len], i) => (
            <group key={`e${i}`} position={[cx, cy, cz]} rotation={[0, 0, rz]}>
              {/* 果实主体 */}
              <mesh castShadow scale={[1, len, 1]}>
                <capsuleGeometry args={[rr, rr * 1.5, 4, 12]} />
                <meshStandardMaterial
                  color={fruit}
                  roughness={0.3}
                  metalness={0.1}
                  emissive="#4c1d95"
                  emissiveIntensity={0.1}
                />
              </mesh>
              {/* 顶部绿色萼片（帽状） */}
              <mesh position={[0, rr * len * 0.75, 0]} castShadow>
                <coneGeometry args={[rr * 1.15, rr * 0.9, 6]} />
                <meshStandardMaterial color="#166534" roughness={0.8} />
              </mesh>
              {/* 短果柄 */}
              <mesh position={[0, rr * len * 1.05, 0]}>
                <cylinderGeometry args={[rr * 0.2, rr * 0.3, rr * 0.6, 6]} />
                <meshStandardMaterial color="#4d7c0f" />
              </mesh>
            </group>
          ))}
        </group>
      );

    default:
      return (
        <mesh position={position} castShadow>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={leaf} />
        </mesh>
      );
  }
}

// ============================================================
// 单个大棚（迷你版，置于农场地上）
// ============================================================
function MiniGreenhouse({
  position,
  data,
  hovered,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  position: [number, number, number];
  data: FarmGreenhouse;
  hovered: boolean;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const W = 1.6; // 棚长 (z 方向)
  const R = 0.55; // 拱半径
  const D = 1.1; // 棚宽 (x 方向)

  const fanRef = useRef<THREE.Group>(null);
  const speedRef = useRef(0);
  const pumpRef = useRef<THREE.Group>(null);
  const pumpSpeedRef = useRef(0);
  const pumpOn = data.waterOn ?? data.motorOn;
  // 性能：风扇/水泵都关闭且已减速到 0 时，tick 不运行（避免 6 个大棚每帧高频计算）
  useFrame((_, delta) => {
    const target = data.motorOn ? 8 : 0;
    const pumpTarget = pumpOn ? -12 : 0;
    // 全部静止时直接跳出
    if (
      target === 0 && pumpTarget === 0 &&
      Math.abs(speedRef.current) < 1e-3 && Math.abs(pumpSpeedRef.current) < 1e-3
    ) return;
    speedRef.current += (target - speedRef.current) * Math.min(1, delta * 4);
    if (fanRef.current) fanRef.current.rotation.z += speedRef.current * delta;
    pumpSpeedRef.current += (pumpTarget - pumpSpeedRef.current) * Math.min(1, delta * 4);
    if (pumpRef.current) pumpRef.current.rotation.y += pumpSpeedRef.current * delta;
  });

  const offline = data.connectionMode === "offline";
  const alert = !!data.hasAlert;
  const glassColor = alert ? "#7f1d1d" : offline ? "#475569" : "#3b82f6";
  const baseEmissive = hovered ? "#22c55e" : "#000000";

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver(e);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut(e);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {/* 透明点击区 (大棚整体包围盒) */}
      <mesh position={[0, R / 2 + 0.1, 0]} visible={false}>
        <boxGeometry args={[D, R + 0.5, W]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* 地基底座 */}
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[D + 0.05, 0.08, W + 0.05]} />
        <meshStandardMaterial
          color={hovered ? "#0ea5e9" : "#475569"}
          emissive={baseEmissive}
          emissiveIntensity={hovered ? 0.4 : 0}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* 玻璃拱顶 (半圆柱体) - 平边下沉贴合地基顶部
          性能：改用 meshStandardMaterial + opacity，避免 transmission 触发额外的 opaque pass */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, W, 24, 1, true, 0, Math.PI]} />
        <meshStandardMaterial
          color={glassColor}
          transparent
          opacity={data.ledOn ? 0.38 : 0.28}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
          emissive={data.ledOn ? "#fde047" : "#000000"}
          emissiveIntensity={data.ledOn ? 0.5 : 0}
        />
      </mesh>

      {/* 前后山墙 */}
      {[-W / 2, W / 2].map((z) => (
        <mesh key={z} position={[0, 0.08, z]}>
          <circleGeometry args={[R, 24, 0, Math.PI]} />
          <meshStandardMaterial
            color={glassColor}
            transparent
            opacity={0.22}
            roughness={0.1}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* 拱筋（前后两道） */}
      {[-W / 2 + 0.02, W / 2 - 0.02].map((z) => (
        <mesh key={z} position={[0, 0.08, z]} rotation={[0, 0, 0]}>
          <torusGeometry args={[R, 0.012, 6, 24, Math.PI]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* 内部植床 (3 列小条) */}
      {[-0.32, 0, 0.32].map((x) => (
        <mesh key={x} position={[x, 0.13, 0]}>
          <boxGeometry args={[0.18, 0.06, W - 0.2]} />
          <meshStandardMaterial color="#5a2f17" />
        </mesh>
      ))}

      {/* 内部植物（按作物类型种植） */}
      {[-0.32, 0, 0.32].map((x) =>
        [-0.55, -0.18, 0.18, 0.55].map((z) => (
          <CropMini key={`${x}-${z}`} crop={data.crop} position={[x, 0.18, z]} />
        )),
      )}

      {/* 补光灯：屋顶下方一颗发光球 + 头顶光晕 */}
      <mesh position={[0, R - 0.02, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color={data.ledOn ? "#fef9c3" : "#1f2937"}
          emissive={data.ledOn ? "#fde047" : "#000000"}
          emissiveIntensity={data.ledOn ? 3.0 : 0}
          toneMapped={false}
        />
      </mesh>
      {data.ledOn && (
        <>
          {/* 实际光源 */}
          <pointLight
            position={[0, R - 0.1, 0]}
            intensity={1.6}
            distance={2.2}
            decay={1.4}
            color="#fde68a"
          />
          {/* 顶部光晕圆环 */}
          <mesh position={[0, R + 0.4, 0]}>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.35} toneMapped={false} />
          </mesh>
          {/* 地面黄光晕 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
            <circleGeometry args={[D * 0.55, 24]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.22} />
          </mesh>
        </>
      )}

      {/* 风扇：后山墙上一个旋转图案 (加大 + 高亮) */}
      <group position={[0.3, R - 0.05, -W / 2 + 0.04]}>
        <mesh>
          <torusGeometry args={[0.13, 0.018, 8, 20]} />
          <meshStandardMaterial
            color={data.motorOn ? "#1d4ed8" : "#1f2937"}
            emissive={data.motorOn ? "#3b82f6" : "#000000"}
            emissiveIntensity={data.motorOn ? 0.6 : 0}
            metalness={0.6}
          />
        </mesh>
        <group ref={fanRef}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <boxGeometry args={[0.22, 0.04, 0.018]} />
              <meshStandardMaterial
                color={data.motorOn ? "#93c5fd" : "#475569"}
                emissive={data.motorOn ? "#3b82f6" : "#000000"}
                emissiveIntensity={data.motorOn ? 0.8 : 0}
                toneMapped={false}
              />
            </mesh>
          ))}
          <mesh>
            <cylinderGeometry args={[0.025, 0.025, 0.03, 12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
        {/* 风扇运行指示灯 */}
        {data.motorOn && (
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </mesh>
        )}
      </group>

      {/* 虚拟水泵电机：前山墙另一侧 (与风扇独立，虚拟场景两个电机) */}
      <group position={[-0.3, 0.14, W / 2 - 0.08]}>
        {/* 水泵外壳 */}
        <mesh castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.1, 16]} />
          <meshStandardMaterial
            color={pumpOn ? "#0e7490" : "#1f2937"}
            emissive={pumpOn ? "#22d3ee" : "#000000"}
            emissiveIntensity={pumpOn ? 0.5 : 0}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        {/* 水泵顶盖 */}
        <mesh position={[0, 0.055, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.015, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.7} />
        </mesh>
        {/* 旋转叶轮 (在4片, 与风扇3片区分) */}
        <group ref={pumpRef} position={[0, 0.02, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} position={[0, 0, 0]}>
              <boxGeometry args={[0.14, 0.012, 0.03]} />
              <meshStandardMaterial
                color={pumpOn ? "#67e8f9" : "#475569"}
                emissive={pumpOn ? "#22d3ee" : "#000000"}
                emissiveIntensity={pumpOn ? 0.7 : 0}
                toneMapped={false}
              />
            </mesh>
          ))}
          <mesh>
            <cylinderGeometry args={[0.02, 0.02, 0.03, 12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
        {/* 输出水管 (向后横铺) */}
        <mesh position={[0.08, 0, -0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.22, 10]} />
          <meshStandardMaterial color={pumpOn ? "#22d3ee" : "#334155"} metalness={0.5} />
        </mesh>
        {/* 运行时的水滴 */}
        {pumpOn && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[0.18 - i * 0.08, -0.02, -0.05]}>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshBasicMaterial color="#7dd3fc" transparent opacity={0.85} toneMapped={false} />
              </mesh>
            ))}
            {/* 运行指示灯 */}
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.022, 8, 8]} />
              <meshBasicMaterial color="#22d3ee" toneMapped={false} />
            </mesh>
            {/* 地面湿润茂 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.05, -0.1, -0.05]}>
              <circleGeometry args={[0.25, 20]} />
              <meshBasicMaterial color="#0ea5e9" transparent opacity={0.28} toneMapped={false} />
            </mesh>
          </>
        )}
      </group>

      {/* 顶部 HTML 标签 */}
      <Html
        position={[0, R + 0.45, 0]}
        center
        distanceFactor={6}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          style={{
            background: hovered
              ? "rgba(34,197,94,0.92)"
              : alert
              ? "rgba(127,29,29,0.92)"
              : "rgba(4,10,22,0.85)",
            color: "#ffffff",
            border: `1px solid ${hovered ? "#4ade80" : alert ? "#ef4444" : "#22c55e55"}`,
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{data.name} · {data.crop}</span>
          {data.ledOn && (
            <span style={{ color: "#fde047", textShadow: "0 0 4px #fde047" }}>☀</span>
          )}
          {data.motorOn && (
            <span style={{ color: "#60a5fa", textShadow: "0 0 4px #60a5fa" }}>❇</span>
          )}
          {pumpOn && (
            <span style={{ color: "#22d3ee", textShadow: "0 0 4px #22d3ee" }}>☁</span>
          )}
        </div>
      </Html>
    </group>
  );
}

// ============================================================
// 周边装饰元素
// ============================================================
function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {/* 树干 */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.8, 8]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.9} />
      </mesh>
      {/* 树冠（3层球） */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.45, 12, 10]} />
        <meshStandardMaterial color="#15803d" roughness={0.85} />
      </mesh>
      <mesh position={[0.15, 1.25, 0.1]} castShadow>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color="#16a34a" roughness={0.85} />
      </mesh>
      <mesh position={[-0.18, 1.15, -0.1]} castShadow>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshStandardMaterial color="#22c55e" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Pond({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 水面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <circleGeometry args={[0.9, 32]} />
        <meshPhysicalMaterial
          color="#0ea5e9"
          transparent
          opacity={0.85}
          roughness={0.05}
          metalness={0.1}
          transmission={0.4}
          thickness={0.2}
        />
      </mesh>
      {/* 水面高光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[0.85, 0.92, 32]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.5} />
      </mesh>
      {/* 石头底床 */}
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[1.0, 1.05, 0.04, 32]} />
        <meshStandardMaterial color="#78716c" roughness={0.95} />
      </mesh>
    </group>
  );
}

function FenceSegment({ position, length = 1, rotationY = 0 }: { position: [number, number, number]; length?: number; rotationY?: number }) {
  const posts: number[] = [];
  for (let i = 0; i <= length; i++) posts.push(i - length / 2);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 竹子 */}
      {posts.map((x) => (
        <mesh key={x} position={[x, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.36, 6]} />
          <meshStandardMaterial color="#a16207" roughness={0.9} />
        </mesh>
      ))}
      {/* 横檑 */}
      <mesh position={[0, 0.27, 0]} castShadow>
        <boxGeometry args={[length + 0.05, 0.025, 0.025]} />
        <meshStandardMaterial color="#854d0e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[length + 0.05, 0.025, 0.025]} />
        <meshStandardMaterial color="#854d0e" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Mountain({ position, scale = 1, color = "#475569" }: { position: [number, number, number]; scale?: number; color?: string }) {
  return (
    <mesh position={position} scale={scale}>
      <coneGeometry args={[1.4, 1.8, 5]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Cloud({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.5, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0.5, 0.05, 0]}>
        <sphereGeometry args={[0.4, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[-0.45, 0.0, 0.1]}>
        <sphereGeometry args={[0.42, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0.15, 0.25, 0]}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.05} />
      </mesh>
    </group>
  );
}

function Windmill({ position }: { position: [number, number, number] }) {
  const bladesRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (bladesRef.current) bladesRef.current.rotation.z += delta * 0.6;
  });
  return (
    <group position={position}>
      {/* 塔柱 */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.12, 3.0, 12]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
      </mesh>
      {/* 顶部帽 */}
      <mesh position={[0, 3.0, 0]} castShadow>
        <coneGeometry args={[0.13, 0.2, 8]} />
        <meshStandardMaterial color="#dc2626" roughness={0.7} />
      </mesh>
      {/* 叶片中心 */}
      <group ref={bladesRef} position={[0, 2.95, 0.13]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * 2 * Math.PI) / 3]}>
            <boxGeometry args={[0.06, 1.0, 0.02]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      </group>
    </group>
  );
}

function GrassTuft({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.04, 0.06, Math.sin(a) * 0.04]} rotation={[0, a, 0]}>
            <coneGeometry args={[0.015, 0.12, 4]} />
            <meshStandardMaterial color={i % 2 ? "#65a30d" : "#84cc16"} />
          </mesh>
        );
      })}
    </group>
  );
}

// ============================================================
// 整片农场地面 + 道路 + 装饰
// ============================================================
function FarmGround() {
  // 随机草丛位置（使用伪随机保证稳定）
  const grassPositions = useMemo<[number, number, number][]>(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i < 70; i++) {
      const seed = i * 9301 + 49297;
      const r1 = ((seed * 7 + 13) % 1000) / 1000;
      const r2 = ((seed * 11 + 17) % 1000) / 1000;
      const x = (r1 - 0.5) * 22;
      const z = (r2 - 0.5) * 11;
      // 避开中央大棚区域 (12 个大棚扩展后 ±10 × ±3)
      if (Math.abs(x) < 10 && Math.abs(z) < 3.2) continue;
      arr.push([x, 0.005, z]);
    }
    return arr;
  }, []);

  return (
    <group>
      {/* 草地边框（最外层 — 扩大到足以填满视口下方） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#4d7c0f" roughness={0.95} />
      </mesh>
      {/* 农田土地（中层） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
        <planeGeometry args={[28, 14]} />
        <meshStandardMaterial color="#78716c" roughness={0.9} />
      </mesh>
      {/* 主耕作区 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 12]} />
        <meshStandardMaterial color="#5a4023" roughness={0.9} />
      </mesh>
      {/* 中央十字小路（硕石色） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[22, 0.7]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[0.7, 10]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.85} />
      </mesh>
      {/* 路边白线 */}
      {[-0.32, 0.32].map((y) => (
        <mesh key={`hr${y}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, y]}>
          <planeGeometry args={[22, 0.04]} />
          <meshBasicMaterial color="#fafafa" />
        </mesh>
      ))}
      {[-0.32, 0.32].map((x) => (
        <mesh key={`vr${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, 0]}>
          <planeGeometry args={[0.04, 10]} />
          <meshBasicMaterial color="#fafafa" />
        </mesh>
      ))}

      {/* 草丛 */}
      {grassPositions.map((p, i) => (
        <GrassTuft key={i} position={p} />
      ))}
    </group>
  );
}

// =============== 天气预报（和风天气 7d, 重庆 101040100） ===============
type QWeatherDaily = {
  fxDate: string;
  tempMax: string;
  tempMin: string;
  textDay: string;
  textNight: string;
  iconDay: string;
  windDirDay: string;
  windScaleDay: string;
};
const QWEATHER_HOST = "https://mf4t2cgffg.re.qweatherapi.com";
const QWEATHER_TOKEN = "1a7d555b3c8149558af49edb7e005083";
const QWEATHER_LOCATION = "101040100"; // 重庆
function weatherEmoji(text: string): string {
  if (/雷/.test(text)) return "⛈️";
  if (/雪/.test(text)) return "🌨️";
  if (/雨/.test(text)) return "🌧️";
  if (/雾|霾/.test(text)) return "🌫️";
  if (/阴/.test(text)) return "☁️";
  if (/多云/.test(text)) return "⛅";
  if (/晴/.test(text)) return "☀️";
  return "🌤️";
}
function WeatherSkyPanel() {
  const [daily, setDaily] = useState<QWeatherDaily[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(
          `${QWEATHER_HOST}/v7/weather/7d?location=${QWEATHER_LOCATION}`,
          { headers: { "X-QW-Api-Key": QWEATHER_TOKEN } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (aborted) return;
        if (data.code !== "200") throw new Error(`code=${data.code}`);
        setDaily(data.daily as QWeatherDaily[]);
        setError(null);
      } catch (e: any) {
        if (!aborted) setError(e?.message ?? "加载失败");
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 5,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(148, 197, 255, 0.4)",
        borderRadius: 12,
        padding: "8px 12px",
        color: "#f8fafc",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
        boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
        width: 580,
        maxWidth: "80%",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
          🌤️ 重庆 · 未来 7 天天气
        </span>
        <span style={{ fontSize: 10, color: "#cbd5e1" }}>QWeather</span>
      </div>
      {error && !daily && (
        <div style={{ fontSize: 11, color: "#fca5a5" }}>加载失败：{error}</div>
      )}
      {!error && !daily && (
        <div style={{ fontSize: 11, color: "#cbd5e1" }}>加载中…</div>
      )}
      {daily && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
          }}
        >
          {daily.slice(0, 7).map((d) => {
            const date = new Date(d.fxDate);
            const md = `${date.getMonth() + 1}/${date.getDate()}`;
            const wd = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
            return (
              <div
                key={d.fxDate}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 7,
                  padding: "5px 3px",
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                <div style={{ color: "#94a3b8", fontSize: 10 }}>
                  {md} 周{wd}
                </div>
                <div style={{ fontSize: 20, margin: "2px 0" }}>
                  {weatherEmoji(d.textDay)}
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 11 }}>{d.textDay}</div>
                <div style={{ color: "#fde68a", fontWeight: 600, fontSize: 11 }}>
                  {d.tempMin}° ~ {d.tempMax}°
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkyAndDistance() {
  return (
    <group>
      {/* 天空球 (内表面渐变天空) */}
      <mesh>
        <sphereGeometry args={[40, 32, 32]} />
        <meshBasicMaterial color="#87ceeb" side={THREE.BackSide} />
      </mesh>
      {/* 远处山脉 */}
      <Mountain position={[-9, 0, -7]} scale={1.6} color="#64748b" />
      <Mountain position={[-5, 0, -8]} scale={2.0} color="#475569" />
      <Mountain position={[0, 0, -8.5]} scale={2.4} color="#334155" />
      <Mountain position={[5, 0, -8]} scale={2.0} color="#475569" />
      <Mountain position={[9, 0, -7]} scale={1.6} color="#64748b" />
      {/* 云朵 */}
      <Cloud position={[-6, 5, -3]} />
      <Cloud position={[3, 6, -4]} />
      <Cloud position={[7, 5.5, -1]} />
      <Cloud position={[-4, 5.8, 4]} />
    </group>
  );
}

function PerimeterDecor() {
  // 周边树在扩大后的农田边界 (外 ±11.5/±5.5)
  const treePositions: [number, number, number][] = [
    // 左侧
    [-11.5, 0, -5.5],
    [-11.5, 0, -3.0],
    [-11.5, 0, -0.5],
    [-11.5, 0, 2.0],
    [-11.5, 0, 4.5],
    [-11.5, 0, 5.5],
    // 右侧
    [11.5, 0, -5.5],
    [11.5, 0, -2.5],
    [11.5, 0, 0],
    [11.5, 0, 2.5],
    [11.5, 0, 5.5],
    // 上边 (z=-5.5)
    [-8.0, 0, -5.5],
    [-4.5, 0, -5.5],
    [-1.0, 0, -5.5],
    [3.0, 0, -5.5],
    [6.5, 0, -5.5],
    [9.5, 0, -5.5],
    // 下边 (z=5.5)
    [-8.0, 0, 5.5],
    [-4.5, 0, 5.5],
    [-1.0, 0, 5.5],
    [3.0, 0, 5.5],
    [6.5, 0, 5.5],
    [9.5, 0, 5.5],
  ];
  return (
    <group>
      {treePositions.map((p, i) => (
        <Tree key={i} position={p} scale={0.85 + (i % 3) * 0.08} />
      ))}
      {/* 四周栅栏 (扩大后) */}
      <FenceSegment position={[0, 0, -5.7]} length={22} />
      <FenceSegment position={[0, 0, 5.7]} length={22} />
      <FenceSegment position={[-11.0, 0, 0]} length={11.4} rotationY={Math.PI / 2} />
      <FenceSegment position={[11.0, 0, 0]} length={11.4} rotationY={Math.PI / 2} />
      {/* 角落小池塘 */}
      <Pond position={[9.8, 0, 4.2]} />
      {/* 风车 (左下角) */}
      <Windmill position={[-10.2, 0, 4.2]} />
    </group>
  );
}

// ============================================================
// Scene
// ============================================================
function FarmScene({
  greenhouses,
  hoveredName,
  setHoveredName,
  onSelect,
}: {
  greenhouses: FarmGreenhouse[];
  hoveredName: string | null;
  setHoveredName: (n: string | null) => void;
  onSelect: (name: string) => void;
}) {
  // 按大棚数量自适应布局 (2 行, 列数随数量扩展; 1 列居中, 2 列水平相邻)
  // 与原 2×3 硬编码保持一致: [-3.5, 0, 3.5] x [-1.45, 2.55]
  const layout = useMemo<[number, number][]>(() => {
    const n = greenhouses.length;
    if (n === 0) return [];
    // 最大单行列数保持在 6 个左右, 超出进入第 2 行
    const cols = Math.min(6, Math.max(1, Math.ceil(n / 2)));
    const rows = Math.ceil(n / cols);
    const xSpacing = 3.5;
    const zRows = rows === 1 ? [0] : [-1.45, 2.55];
    const positions: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = (c - (cols - 1) / 2) * xSpacing;
      const z = zRows[Math.min(r, zRows.length - 1)];
      positions.push([x, z]);
    }
    return positions;
  }, [greenhouses.length]);

  return (
    <>
      <ambientLight intensity={1.0} />
      {/* directionalLight 取消 castShadow：已以 ContactShadows 提供地面 AO，避免阴影通道 */}
      <directionalLight position={[6, 10, 6]} intensity={1.5} />
      <directionalLight position={[-6, 8, -4]} intensity={0.5} color="#bee3f8" />
      <hemisphereLight args={["#dbeafe", "#65a30d", 0.7]} />
      {/* 太阳本体可见 */}
      <mesh position={[10, 13, -8]}>
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshBasicMaterial color="#fef9c3" toneMapped={false} />
      </mesh>

      <SkyAndDistance />
      <PerimeterDecor />
      <FarmGround />

      {greenhouses.map((g, i) => {
        const [x, z] = layout[i] ?? [0, 0];
        return (
          <MiniGreenhouse
            key={g.name}
            position={[x, 0.04, z]}
            data={g}
            hovered={hoveredName === g.name}
            onPointerOver={() => setHoveredName(g.name)}
            onPointerOut={() => setHoveredName(null)}
            onClick={() => onSelect(g.name)}
          />
        );
      })}

      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={32} blur={2.5} far={6} />
    </>
  );
}

// ============================================================
// Export
// ============================================================
export function FarmDigitalTwin3D({ greenhouses, onSelect }: Props) {
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  // 默认关闭手势控制，由用户手动开启
  const [gestureMode, setGestureMode] = useState(false);
  const [handStatus, setHandStatus] = useState<"idle" | "tracking" | "lost">("idle");
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const initialCamPos = useRef<[number, number, number]>([14, 10, 14]);
  const initialTarget = useRef<[number, number, number]>([0, 0.5, 0]);

  // ── 手势驱动 3D 视角："地球仪式握拳拖拽" + 张开手时双指捏合缩放（带平滑） ──
  useEffect(() => {
    if (!gestureMode) {
      setHandStatus("idle");
      return;
    }
    setHandStatus("tracking");

    // ── 状态机：是否正在抓取 ──
    let isGrabbing = false;
    // 抓取瞬间记录的锚点（手掌中心 X/Y）+ 手掌基准长度（用于标准化）
    let anchorX = 0;
    let anchorY = 0;
    let anchorTheta = 0;     // 抓取瞬间的相机 theta
    let anchorPhi = 0;       // 抓取瞬间的相机 phi
    let refLength = 1;       // 手掌基准长度（腕 → 中指根）

    // 相机平滑目标（仅角度；缩放已禁用）
    let targetTheta = 0;
    let targetPhi = 0;
    let targetRadius = 0;       // 由 OrbitControls 初始化，不再被手势修改
    let initialized = false;

    // ── 参数 ──
    // 拖拽：标准化位移 = ΔX / 手掌基准长度，再乘以以下系数得到弧度
    const DRAG_GAIN_X = 3.5;            // 横向：手平移≈1 个手掌长度 → 转 3.5 弧度
    const DRAG_GAIN_Y = 2.6;            // 纵向：稍弱
    const DRAG_DEADZONE = 0.05;         // 标准化偏移 < 5% 视为不动（死区）
    // 缩放已禁用：只保留握拳拖拽旋转视角
    // ── 平滑滤波：One Euro Filter ──
    // 静止/微动时大幅平滑（消除手颤），快速移动时几乎零延迟跟随
    // 参考: https://gery.casiez.net/1euro/
    class OneEuroFilter {
      private xPrev: number | null = null;
      private dxPrev = 0;
      private tPrev = 0;
      constructor(private minCutoff: number, private beta: number, private dCutoff: number) {}
      private alpha(cutoff: number, dt: number) {
        const tau = 1 / (2 * Math.PI * cutoff);
        return 1 / (1 + tau / dt);
      }
      reset() { this.xPrev = null; this.dxPrev = 0; this.tPrev = 0; }
      filter(x: number, t: number): number {
        if (this.xPrev === null) { this.xPrev = x; this.tPrev = t; return x; }
        const dt = Math.max((t - this.tPrev) / 1000, 1e-3); // 秒
        const dx = (x - this.xPrev) / dt;
        const aD = this.alpha(this.dCutoff, dt);
        const dxHat = aD * dx + (1 - aD) * this.dxPrev;
        const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        const aX = this.alpha(cutoff, dt);
        const xHat = aX * x + (1 - aX) * this.xPrev;
        this.xPrev = xHat;
        this.dxPrev = dxHat;
        this.tPrev = t;
        return xHat;
      }
    }
    // 角度（弧度）：minCutoff 越小越柔；beta 越大对快速运动响应越灵敏
    const filterTheta  = new OneEuroFilter(/*min*/0.8, /*beta*/0.4, /*dCutoff*/1.0);
    const filterPhi    = new OneEuroFilter(0.8, 0.4, 1.0);

    const initSpherical = () => {
      const ctl = orbitRef.current;
      if (!ctl || initialized) return;
      const cam = ctl.object as THREE.PerspectiveCamera;
      const offset = new THREE.Vector3().subVectors(cam.position, ctl.target);
      const sph = new THREE.Spherical().setFromVector3(offset);
      targetTheta = sph.theta;
      targetPhi = sph.phi;
      targetRadius = sph.radius;
      initialized = true;
    };

    // 几何判定：4 指（食指/中指/无名指/小指）指尖距腕 < MCP 距腕 → 该指弯曲
    // 4 指都弯曲 → 握拳
    const detectFist = (tipsToWrist: number[], mcpsToWrist: number[]): boolean => {
      let bent = 0;
      for (let i = 0; i < 4; i += 1) {
        // 指尖距腕 / MCP 距腕 < 0.95 视为弯曲（留 5% 缓冲，避免临界抖动）
        if (tipsToWrist[i] < mcpsToWrist[i] * 0.95) bent += 1;
      }
      return bent >= 4;
    };

    const handHandler = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        anchor: { x: number; y: number };
        pinchDistance: number;
        pinchRatio: number;
        palmWidth: number;
        tipsToWrist: number[];
        mcpsToWrist: number[];
        palmRefLength: number;
        timestamp?: number;
      }>).detail;
      if (!detail) return;
      setHandStatus("tracking");
      initSpherical();

      const now = detail.timestamp ?? performance.now();
      const fistNow = detectFist(detail.tipsToWrist, detail.mcpsToWrist);

      // ── 状态切换：张开 → 握拳：设定锚点 ──
      if (fistNow && !isGrabbing) {
        isGrabbing = true;
        anchorX = detail.anchor.x;
        anchorY = detail.anchor.y;
        anchorTheta = targetTheta;
        anchorPhi = targetPhi;
        refLength = Math.max(detail.palmRefLength, 1e-3);
      }

      // ── 状态切换：握拳 → 张开：释放 ──
      if (!fistNow && isGrabbing) {
        isGrabbing = false;
      }

      if (isGrabbing) {
        // 握拳拖拽：相对于锚点 + 标准化 + 死区 → 绝对设定相机
        const dx = detail.anchor.x - anchorX;
        const dy = detail.anchor.y - anchorY;
        const normX = dx / refLength;
        const normY = dy / refLength;

        // 死区：小于阈值视为零
        const ndx = Math.abs(normX) < DRAG_DEADZONE ? 0 : normX;
        const ndy = Math.abs(normY) < DRAG_DEADZONE ? 0 : normY;

        // 手向右移 (ndx>0) → 视角向左转（theta 减少）→ 拖拽地球的体感
        targetTheta = anchorTheta - ndx * DRAG_GAIN_X;
        targetPhi = Math.max(0.15, Math.min(Math.PI / 2.05,
          anchorPhi + ndy * DRAG_GAIN_Y,
        ));
      }
      // 张开手时：不做任何动作（缩放已禁用）
    };

    const lostHandler = () => {
      setHandStatus("lost");
      // 手丢失：释放抓取
      isGrabbing = false;
    };

    // 平滑 lerp 循环
    let raf = 0;
    const EPS_ANGLE = 1e-4;
    const animate = () => {
      const ctl = orbitRef.current;
      if (ctl && initialized) {
        const cam = ctl.object as THREE.PerspectiveCamera;
        const offset = new THREE.Vector3().subVectors(cam.position, ctl.target);
        const sph = new THREE.Spherical().setFromVector3(offset);

        const tNow = performance.now();

        // 角度：保持原 One Euro Filter 逻辑（视角转换不动）
        const newTheta  = filterTheta.filter(targetTheta,   tNow);
        const newPhi    = filterPhi.filter(targetPhi,       tNow);
        // 半径：不再由手势控制，保留用户鼠标滚轮缩放（OrbitControls 自己维护 sph.radius）

        const dTheta  = newTheta  - sph.theta;
        const dPhi    = newPhi    - sph.phi;
        if (Math.abs(dTheta) > EPS_ANGLE || Math.abs(dPhi) > EPS_ANGLE) {
          sph.theta  = newTheta;
          sph.phi    = newPhi;
          offset.setFromSpherical(sph);
          cam.position.copy(ctl.target).add(offset);
          cam.lookAt(ctl.target);
          ctl.update();
        }
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    window.addEventListener("yaya:hand", handHandler as EventListener);
    window.addEventListener("yaya:hand-lost", lostHandler as EventListener);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("yaya:hand", handHandler as EventListener);
      window.removeEventListener("yaya:hand-lost", lostHandler as EventListener);
    };
  }, [gestureMode]);

  // 双击「手势已开启」按钮可重置视角
  const resetView = () => {
    const ctl = orbitRef.current;
    if (!ctl) return;
    const cam = ctl.object as THREE.PerspectiveCamera;
    cam.position.set(...initialCamPos.current);
    ctl.target.set(...initialTarget.current);
    ctl.update();
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height: "calc(100vh - 96px)",
        minHeight: 680,
        background: "linear-gradient(180deg,#87ceeb 0%,#bfdbfe 70%,#dcfce7 100%)",
      }}
    >
      {/* Header */}
      <div
        className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#22c55e30", background: "rgba(4,10,22,0.82)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="w-2 h-2 rounded-full bg-green-400 shrink-0"
            style={{ boxShadow: "0 0 6px #4ade80" }}
          />
          <span className="text-green-300 text-xs font-bold tracking-widest">智慧农场 · 3D 数字孪生总览</span>
          <span className="text-cyan-400 text-xs">·</span>
          <span className="text-cyan-300 text-xs font-semibold">{greenhouses.length} 座大棚</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetView}
            className="text-[11px] px-2 py-1 rounded border border-gray-600 bg-black/40 text-gray-300 hover:border-cyan-400 hover:text-cyan-200 transition-colors"
            title="重置视角"
          >
            ↺ 重置
          </button>
          <button
            onClick={() => setGestureMode((v) => !v)}
            className={`text-[11px] px-2.5 py-1 rounded border transition-all ${
              gestureMode
                ? "bg-green-500/20 border-green-400 text-green-200 shadow-[0_0_8px_rgba(74,222,128,0.5)]"
                : "bg-black/40 border-gray-600 text-gray-300 hover:border-green-500"
            }`}
            title="手势控制：手掌移动旋转视角，拇指食指捏合缩放"
          >
            {gestureMode ? "✋ 手势已开启" : "✋ 手势控制"}
          </button>
          <span className="text-[11px] text-gray-400">点击大棚进入详情</span>
        </div>
      </div>

      <Canvas
        // shadows 关闭：场景里有 1000+ 作物/装饰 mesh，阴影通道每帧重渲染成本极高；
        // 地面 AO 已由 ContactShadows 提供，视觉差异几乎不可见
        shadows={false}
        // DPR 封顶 1.5：Retina/4K 下像素数量 ×1.5 的渲染量，而非 ×2
        dpr={[1, 1.5]}
        // 渲染器调优：保留 antialias 但启用 high-performance GPU
        gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
        camera={{ position: [14, 11, 16], fov: 45 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={<Html center><span style={{ color: "#22c55e" }}>加载 3D 场景中…</span></Html>}>
          <FarmScene
            greenhouses={greenhouses}
            hoveredName={hoveredName}
            setHoveredName={setHoveredName}
            onSelect={onSelect}
          />
          <OrbitControls
            ref={orbitRef as any}
            enablePan={false}
            minDistance={6}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 2.2, 0]}
            // 手势模式下：关闭阻尼，避免与我们自己的 lerp 平滑产生叠加惯性导致"无手时仍漂移"
            enableDamping={!gestureMode}
            // 手势模式下禁用鼠标，以免与手势冲突
            enableRotate={!gestureMode}
            enableZoom={!gestureMode}
          />
        </Suspense>
      </Canvas>

      {/* 操作提示 */}
      {!gestureMode && (
        <div className="absolute right-3 top-12 text-[10px] text-gray-400 bg-black/40 rounded px-2 py-1 z-10 pointer-events-none">
          鼠标拖拽旋转 · 滚轮缩放 · 点击大棚查看详情
        </div>
      )}

      {/* 天气大屏：固定 DOM 覆盖层，不随 3D 视角变化 */}
      <WeatherSkyPanel />

      {/* 手势模式提示面板 */}
      {gestureMode && (
        <div className="absolute left-3 top-12 z-10 pointer-events-none bg-black/70 border border-green-700 text-green-200 rounded p-2 text-[11px] leading-relaxed shadow-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-2 h-2 rounded-full ${
              handStatus === "tracking" ? "bg-green-400 animate-pulse" :
              handStatus === "lost" ? "bg-yellow-400" : "bg-gray-500"
            }`} />
            <span className="font-bold text-green-300">手势控制（地球仪式拖拽）</span>
          </div>
          <div>✊ 握拳并移动 → 拖动旋转视角</div>
          <div>🖐️ 张开手 → 释放（停止旋转）</div>
          <div className="mt-1 pt-1 border-t border-green-800 text-[10px]">
            状态: <span className={
              handStatus === "tracking" ? "text-green-300" :
              handStatus === "lost" ? "text-yellow-300" : "text-gray-400"
            }>
              {handStatus === "tracking" ? "已追踪到手部" : handStatus === "lost" ? "未检测到手" : "等待识别"}
            </span>
          </div>
        </div>
      )}

      {/* 当前 hover 信息条 */}
      {hoveredName && (
        <div className="absolute left-3 bottom-3 z-10 pointer-events-none bg-black/60 border border-green-700 text-green-200 text-xs px-3 py-1.5 rounded">
          {hoveredName} · 点击进入详情
        </div>
      )}
    </div>
  );
}
