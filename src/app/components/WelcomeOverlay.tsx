import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { speak } from "../lib/speech";

interface Props {
  displayName: string;
  onDone: () => void;
}

/**
 * iOS 风格登录欢迎动画覆盖层。
 * 挂载后立即触发语音播报，约 2.8s 后调用 onDone（跳转主界面）。
 */
export function WelcomeOverlay({ displayName, onDone }: Props) {
  const [exiting, setExiting] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // 语音播报（延迟 200ms 等待浏览器 TTS 引擎就绪）
    const speakTimer = setTimeout(() => {
      speak(`${displayName}，欢迎您使用智慧农业管理系统`);
    }, 200);

    // 开始退场动画
    const exitTimer = setTimeout(() => setExiting(true), 2500);
    // 动画结束后导航
    const doneTimer = setTimeout(() => onDoneRef.current(), 3050);

    return () => {
      clearTimeout(speakTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: exiting
          ? "wOverlayOut 0.55s ease-in forwards"
          : "wOverlayIn 0.35s ease-out forwards",
      }}
    >
      {/* 毛玻璃背景 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(5, 46, 22, 0.88)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
        }}
      />

      {/* 背景光晕粒子 */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "12%",
          width: 240,
          height: 240,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 70%)",
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />

      {/* 主卡片（iOS 风格弹出） */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: exiting
            ? "wCardOut 0.55s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "wCardIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {/* 图标区域（带脉冲环） */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          {/* 脉冲环 1 */}
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: "1.5px solid rgba(74,222,128,0.35)",
              animation: "wRipple 2.4s ease-out 0.8s infinite",
            }}
          />
          {/* 脉冲环 2 */}
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: "1px solid rgba(74,222,128,0.2)",
              animation: "wRipple 2.4s ease-out 1.35s infinite",
            }}
          />

          {/* 图标背景光晕 */}
          <div
            style={{
              position: "absolute",
              width: 110,
              height: 110,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(74,222,128,0.2) 0%, transparent 70%)",
              filter: "blur(14px)",
            }}
          />

          {/* 图标主体（iOS 玻璃质感） */}
          <div
            style={{
              position: "relative",
              width: 90,
              height: 90,
              borderRadius: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow:
                "0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(255,255,255,0.1)",
              animation: "wIconIn 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s both",
            }}
          >
            <Leaf style={{ width: 46, height: 46, color: "#4ade80" }} />
          </div>
        </div>

        {/* 文字区域 */}
        <div
          style={{
            textAlign: "center",
            animation: "wTextIn 0.55s ease-out 0.48s both",
          }}
        >
          {/* 副标题 */}
          <div
            style={{
              color: "rgba(187,247,208,0.72)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            欢迎回来
          </div>

          {/* 用户名 */}
          <div
            style={{
              color: "#ffffff",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              textShadow: "0 2px 20px rgba(0,0,0,0.35)",
              marginBottom: 10,
            }}
          >
            {displayName}
          </div>

          {/* 系统名称 */}
          <div
            style={{
              color: "rgba(187,247,208,0.6)",
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: "0.02em",
            }}
          >
            智慧农业管理系统
          </div>
        </div>

        {/* 进度条 */}
        <div
          style={{
            marginTop: 44,
            width: 160,
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
            animation: "wTextIn 0.55s ease-out 0.7s both",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              background: "linear-gradient(90deg, #4ade80, #86efac, #4ade80)",
              backgroundSize: "200% 100%",
              animation: "wProgress 2.15s ease-out 0.8s both, wProgressShimmer 1.5s ease-in-out 1s infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
