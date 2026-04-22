/**
 * 3D Farm Digital Twin — 一块土地上的 6 个大棚总览
 *
 * - 单卡片，6 个大棚按 2×3 排列在同一片土地上
 * - 每个大棚可点击 → 触发 onSelect(name) 进入详情
 * - 鼠标悬浮高亮，名字浮空显示
 * - 状态指示：补光灯亮 → 灯泡发黄光；风扇开 → 蓝色风扇标识旋转
 */
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

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
        <span className="text-[11px] text-gray-400">点击大棚进入实时详情</span>
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
            enablePan={false}
            minDistance={6}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 2.2, 0]}
          />
        </Suspense>
      </Canvas>

      {/* 操作提示 */}
      <div className="absolute right-3 top-12 text-[10px] text-gray-400 bg-black/40 rounded px-2 py-1 z-10 pointer-events-none">
        鼠标拖拽旋转 · 滚轮缩放 · 点击大棚查看详情
      </div>

      {/* 当前 hover 信息条 */}
      {hoveredName && (
        <div className="absolute left-3 bottom-3 z-10 pointer-events-none bg-black/60 border border-green-700 text-green-200 text-xs px-3 py-1.5 rounded">
          {hoveredName} · 点击进入详情
        </div>
      )}
    </div>
  );
}
