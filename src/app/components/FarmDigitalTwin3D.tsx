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

export type ConnMode = "live" | "waiting" | "offline";

export interface FarmGreenhouse {
  name: string;
  crop: string;
  ledOn: boolean;
  motorOn: boolean;
  connectionMode: ConnMode;
  hasAlert?: boolean;
}

interface Props {
  greenhouses: FarmGreenhouse[];
  onSelect: (name: string) => void;
}

// ============================================================
// 单株作物迷你模型（按作物类型生成不同造型）
// ============================================================
function CropMini({ crop, position }: { crop: string; position: [number, number, number] }) {
  const [fruit, leaf] = CROP_PAL[crop] ?? CROP_PAL["番茄"];

  switch (crop) {
    // 番茄：直立茎 + 圆叶团 + 红色果实
    case "番茄":
      return (
        <group position={position}>
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.018, 0.16, 6]} />
            <meshStandardMaterial color="#65a30d" />
          </mesh>
          <mesh position={[0, 0.16, 0]} castShadow>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshStandardMaterial color={leaf} />
          </mesh>
          <mesh position={[0.06, 0.13, 0.03]} castShadow>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[-0.05, 0.10, -0.04]} castShadow>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.2} />
          </mesh>
        </group>
      );

    // 黄瓜：藤架 + 长椭圆果
    case "黄瓜":
      return (
        <group position={position}>
          {/* 支架杆 */}
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.24, 6]} />
            <meshStandardMaterial color="#a16207" />
          </mesh>
          {/* 藤叶 */}
          <mesh position={[0, 0.18, 0]} castShadow>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={leaf} />
          </mesh>
          {/* 黄瓜（细长椭球） */}
          <mesh position={[0.05, 0.10, 0]} rotation={[0, 0, Math.PI / 2.5]} castShadow scale={[1, 2.5, 1]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color={fruit} />
          </mesh>
          <mesh position={[-0.04, 0.07, 0.03]} rotation={[0, 0, -Math.PI / 3]} castShadow scale={[1, 2.2, 1]}>
            <sphereGeometry args={[0.02, 10, 8]} />
            <meshStandardMaterial color={fruit} />
          </mesh>
        </group>
      );

    // 草莓：低矮丛 + 红色小球
    case "草莓":
      return (
        <group position={position}>
          {/* 叶丛 */}
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.05, 0.04, Math.sin(a) * 0.05]}
                rotation={[Math.PI / 2.5, 0, a]}
                castShadow
              >
                <coneGeometry args={[0.04, 0.09, 4]} />
                <meshStandardMaterial color={leaf} />
              </mesh>
            );
          })}
          {/* 草莓果实 */}
          <mesh position={[0.04, 0.05, 0]} castShadow scale={[1, 1.3, 1]}>
            <coneGeometry args={[0.025, 0.05, 8]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[-0.03, 0.05, 0.04]} castShadow scale={[1, 1.3, 1]}>
            <coneGeometry args={[0.022, 0.045, 8]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.15} />
          </mesh>
        </group>
      );

    // 辣椒：直立茎 + 下垂红辣椒
    case "辣椒":
      return (
        <group position={position}>
          <mesh position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[0.011, 0.014, 0.2, 6]} />
            <meshStandardMaterial color="#65a30d" />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color={leaf} />
          </mesh>
          {/* 下垂的辣椒 */}
          <mesh position={[0.04, 0.12, 0]} rotation={[0, 0, Math.PI / 7]} castShadow scale={[1, 2.5, 1]}>
            <coneGeometry args={[0.018, 0.05, 8]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[-0.04, 0.10, 0.02]} rotation={[0, 0, -Math.PI / 7]} castShadow scale={[1, 2.5, 1]}>
            <coneGeometry args={[0.016, 0.045, 8]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.2} />
          </mesh>
        </group>
      );

    // 生菜：圆球状叶团（深绿）
    case "生菜":
      return (
        <group position={position}>
          {/* 多片叶子层叠 */}
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.04, 0.05, Math.sin(a) * 0.04]}
                rotation={[Math.PI / 4, a, 0]}
                castShadow
              >
                <sphereGeometry args={[0.06, 8, 6]} />
                <meshStandardMaterial color={leaf} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.07, 0]} castShadow>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshStandardMaterial color={fruit} />
          </mesh>
        </group>
      );

    // 茄子：紫色椭圆果实
    case "茄子":
      return (
        <group position={position}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.016, 0.18, 6]} />
            <meshStandardMaterial color="#65a30d" />
          </mesh>
          <mesh position={[0, 0.16, 0]} castShadow>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={leaf} />
          </mesh>
          {/* 茄子果（紫色细椭圆） */}
          <mesh position={[0.05, 0.10, 0]} rotation={[0, 0, Math.PI / 6]} castShadow scale={[1, 2, 1]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[-0.04, 0.08, 0.03]} rotation={[0, 0, -Math.PI / 6]} castShadow scale={[1, 2, 1]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color={fruit} emissive={fruit} emissiveIntensity={0.15} />
          </mesh>
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
  useFrame((_, delta) => {
    const target = data.motorOn ? 8 : 0;
    speedRef.current += (target - speedRef.current) * Math.min(1, delta * 4);
    if (fanRef.current) fanRef.current.rotation.z += speedRef.current * delta;
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

      {/* 玻璃拱顶 (半圆柱体) - 平边下沉贴合地基顶部 */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, W, 24, 1, true, 0, Math.PI]} />
        <meshPhysicalMaterial
          color={glassColor}
          transparent
          opacity={data.ledOn ? 0.45 : 0.32}
          roughness={0.05}
          transmission={0.7}
          thickness={0.05}
          side={THREE.DoubleSide}
          emissive={data.ledOn ? "#fde047" : "#000000"}
          emissiveIntensity={data.ledOn ? 0.5 : 0}
        />
      </mesh>

      {/* 前后山墙 */}
      {[-W / 2, W / 2].map((z) => (
        <mesh key={z} position={[0, 0.08, z]}>
          <circleGeometry args={[R, 24, 0, Math.PI]} />
          <meshPhysicalMaterial
            color={glassColor}
            transparent
            opacity={0.28}
            roughness={0.05}
            transmission={0.8}
            thickness={0.05}
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
    for (let i = 0; i < 40; i++) {
      const seed = i * 9301 + 49297;
      const r1 = ((seed * 7 + 13) % 1000) / 1000;
      const r2 = ((seed * 11 + 17) % 1000) / 1000;
      const x = (r1 - 0.5) * 13;
      const z = (r2 - 0.5) * 9;
      // 避开中央大棚区域
      if (Math.abs(x) < 4.5 && Math.abs(z) < 2.8) continue;
      arr.push([x, 0.005, z]);
    }
    return arr;
  }, []);

  return (
    <group>
      {/* 草地边框（最外层 — 扩大到足以填满视口下方） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 50]} />
        <meshStandardMaterial color="#4d7c0f" roughness={0.95} />
      </mesh>
      {/* 农田土地（中层） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
        <planeGeometry args={[18, 13]} />
        <meshStandardMaterial color="#78716c" roughness={0.9} />
      </mesh>
      {/* 主耕作区 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#5a4023" roughness={0.9} />
      </mesh>
      {/* 中央十字小路（硕石色） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[12, 0.7]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[0.7, 8]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.85} />
      </mesh>
      {/* 路边白线 */}
      {[-0.32, 0.32].map((y) => (
        <mesh key={`hr${y}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, y]}>
          <planeGeometry args={[12, 0.04]} />
          <meshBasicMaterial color="#fafafa" />
        </mesh>
      ))}
      {[-0.32, 0.32].map((x) => (
        <mesh key={`vr${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, 0]}>
          <planeGeometry args={[0.04, 8]} />
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
  // 周边树在农田边界 (外 ±6.5/±4.5)
  const treePositions: [number, number, number][] = [
    [-6.5, 0, -4.5],
    [-6.5, 0, -2.0],
    [-6.5, 0, 0.5],
    [-6.5, 0, 3.0],
    [-6.5, 0, 4.5],
    [6.5, 0, -4.5],
    [6.5, 0, -1.5],
    [6.5, 0, 1.5],
    [6.5, 0, 4.5],
    [-4.0, 0, -4.5],
    [4.0, 0, -4.5],
    [-2.0, 0, 4.5],
    [2.0, 0, 4.5],
  ];
  return (
    <group>
      {treePositions.map((p, i) => (
        <Tree key={i} position={p} scale={0.85 + (i % 3) * 0.08} />
      ))}
      {/* 四周栅栏 */}
      <FenceSegment position={[0, 0, -4.7]} length={12} />
      <FenceSegment position={[0, 0, 4.7]} length={12} />
      <FenceSegment position={[-6.0, 0, 0]} length={9.4} rotationY={Math.PI / 2} />
      <FenceSegment position={[6.0, 0, 0]} length={9.4} rotationY={Math.PI / 2} />
      {/* 角落小池塘 */}
      <Pond position={[5.2, 0, 3.4]} />
      {/* 风车 (左下角) */}
      <Windmill position={[-5.6, 0, 3.4]} />
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
  // 2×3 layout: cols(z): -1.45, 2.55 ; rows(x): -3.5, 0, 3.5
  // 整体向前(+z) 平移 R≈0.55,让大棚在画面中下移
  const layout: [number, number][] = [
    [-3.5, -1.45],
    [0, -1.45],
    [3.5, -1.45],
    [-3.5, 2.55],
    [0, 2.55],
    [3.5, 2.55],
  ];

  return (
    <>
      <ambientLight intensity={1.0} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
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

      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={20} blur={2.5} far={6} />
    </>
  );
}

// ============================================================
// Export
// ============================================================
export function FarmDigitalTwin3D({ greenhouses, onSelect }: Props) {
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  // 进入此组件即自动开启手势控制
  const [gestureMode, setGestureMode] = useState(true);
  const [handStatus, setHandStatus] = useState<"idle" | "tracking" | "lost">("idle");
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const initialCamPos = useRef<[number, number, number]>([9, 7, 9]);
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

    // 缩放（仅在"未抓取"时启用，连续增量式：每帧 Δratio 转指数因子乘到 targetRadius）
    let prevPinchRatio: number | null = null;       // 上一帧已平滑的 pinchRatio

    // 相机平滑目标
    let targetTheta = 0;
    let targetPhi = 0;
    let targetRadius = 0;
    let initialized = false;

    // ── 参数 ──
    // 拖拽：标准化位移 = ΔX / 手掌基准长度，再乘以以下系数得到弧度
    const DRAG_GAIN_X = 3.5;            // 横向：手平移≈1 个手掌长度 → 转 3.5 弧度
    const DRAG_GAIN_Y = 2.6;            // 纵向：稍弱
    const DRAG_DEADZONE = 0.05;         // 标准化偏移 < 5% 视为不动（死区）
    // ── 缩放：行业标准"增量 + 指数 + 目标逼近"三步走 ──
    // 1) 增量驱动：取 pinchRatio 的"帧间差值 Δ"作为信号源（手指捏合像鼠标滚轮）
    // 2) 指数映射：Δ → 比例因子，乘到 targetRadius 上（人对缩放的感知是乘法）
    // 3) 目标逼近：targetRadius 由 One Euro Filter 平滑收敛到实际相机半径
    // 标准化捏合比例 pinchRatio = dist(拇指尖4, 食指尖8) / dist(食指根5, 小指根17)
    const ZOOM_GAIN = 1.6;                // 指数增益：Δratio=1 → 半径 ×e^(±1.6) ≈ ±5x
    const ZOOM_DEADZONE = 0.012;          // |Δratio| < 0.012 视为手颤，丢弃
    const ZOOM_DELTA_CLAMP = 0.15;        // 单帧 |Δratio| 超过 0.15 视为跳变（识别噪声），丢弃
    const PINCH_VALID_MIN = 0.05;         // pinchRatio 太小（手指完全重叠）通常是误检，跳过
    const PINCH_VALID_MAX = 1.6;          // pinchRatio 太大（关键点跳飞）跳过
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
    // 半径：minCutoff 偏柔，beta 略大，让快速捏合时仍能跟住，慢动作时极致平滑
    const filterRadius = new OneEuroFilter(/*min*/1.2, /*beta*/0.6, /*dCutoff*/1.0);
    // pinchRatio 源头平滑：手指尖抖动幅度大，必须在【输入端】先吃掉抖动
    const filterPinch  = new OneEuroFilter(/*min*/1.5, /*beta*/0.05, /*dCutoff*/1.0);

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
        // 释放后立即把缩放基线重置（避免把"释放瞬间的快速变化"当作有效缩放增量）
        prevPinchRatio = null;
        filterPinch.reset();
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
      } else {
        // 张开手时：连续缩放（增量驱动 + 指数映射 + 目标逼近）
        const rawRatio = detail.pinchRatio;

        // 输入端有效性过滤：跳过明显的关键点跳变 / 误检
        if (rawRatio < PINCH_VALID_MIN || rawRatio > PINCH_VALID_MAX) {
          // 视为无效帧，不更新基线，等待下一帧稳定
        } else {
          // ① 源头先做 One Euro 平滑，吃掉指尖颤抖（这步是关键！）
          const smoothedRatio = filterPinch.filter(rawRatio, now);

          if (prevPinchRatio === null) {
            // 第一帧：仅建立基线，不缩放
            prevPinchRatio = smoothedRatio;
          } else {
            // ② 计算帧间增量 Δ（手指张开 → Δ>0 → 放大；捏合 → Δ<0 → 缩小）
            let delta = smoothedRatio - prevPinchRatio;

            // 死区：< 1.2% 视为手颤丢弃
            if (Math.abs(delta) < ZOOM_DEADZONE) delta = 0;
            // 跳变保护：单帧位移过大视为识别噪声，丢弃
            if (Math.abs(delta) > ZOOM_DELTA_CLAMP) delta = 0;

            if (delta !== 0) {
              // ③ 指数映射：delta 转比例因子，乘到目标半径
              //   delta>0（张开）→ factor<1 → 半径减小 → 拉近
              //   delta<0（捏合）→ factor>1 → 半径增大 → 拉远
              const factor = Math.exp(-delta * ZOOM_GAIN);
              targetRadius = Math.max(6, Math.min(20, targetRadius * factor));
            }
            prevPinchRatio = smoothedRatio;
          }
        }
      }
    };

    const lostHandler = () => {
      setHandStatus("lost");
      // 手丢失：释放抓取，清空缩放状态
      isGrabbing = false;
      prevPinchRatio = null;
      filterPinch.reset();
    };

    // 平滑 lerp 循环
    let raf = 0;
    const EPS_ANGLE = 1e-4;
    const EPS_RADIUS = 1e-3;
    const animate = () => {
      const ctl = orbitRef.current;
      if (ctl && initialized) {
        const cam = ctl.object as THREE.PerspectiveCamera;
        const offset = new THREE.Vector3().subVectors(cam.position, ctl.target);
        const sph = new THREE.Spherical().setFromVector3(offset);

        const tNow = performance.now();
        // 用 One Euro Filter 把"目标值"过滤为这一帧应该到达的值
        // 静止 → 强平滑（吃掉手颤）；快速运动 → 弱平滑（紧贴手）
        const newTheta  = filterTheta.filter(targetTheta,   tNow);
        const newPhi    = filterPhi.filter(targetPhi,       tNow);
        const newRadius = filterRadius.filter(targetRadius, tNow);

        const dTheta  = newTheta  - sph.theta;
        const dPhi    = newPhi    - sph.phi;
        const dRadius = newRadius - sph.radius;
        if (Math.abs(dTheta) > EPS_ANGLE || Math.abs(dPhi) > EPS_ANGLE || Math.abs(dRadius) > EPS_RADIUS) {
          sph.theta  = newTheta;
          sph.phi    = newPhi;
          sph.radius = newRadius;
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
        height: 620,
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
        shadows
        dpr={[1, 2]}
        camera={{ position: [9, 8, 11], fov: 45 }}
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
          <div>🤏 拇指食指<b>持续捏合</b>（越捏越近）→ 缩小</div>
          <div>👌 拇指食指<b>持续张开</b>（越张越远）→ 放大</div>
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
