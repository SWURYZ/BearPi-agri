import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { speak } from "../lib/speech";
import {
  type ExpressionResult,
  EXPRESSION_CONFIG,
  detectExpression,
  detectExpressionFromCamera,
  loadExpressionModels,
} from "../lib/faceExpression";

interface Props {
  displayName: string;
  faceCanvas?: HTMLCanvasElement | null;
  onDone: () => void;
}

export function WelcomeOverlay({ displayName, faceCanvas, onDone }: Props) {
  const [exiting, setExiting] = useState(false);
  const [exprResult, setExprResult] = useState<ExpressionResult | null>(null);
  const [exprVisible, setExprVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    loadExpressionModels().catch(() => {});

    async function runDetect() {
      try {
        let result: ExpressionResult | null = null;
        if (faceCanvas) {
          result = await detectExpression(faceCanvas);
        } else {
          result = await detectExpressionFromCamera();
        }
        if (!cancelled) {
          setExprResult(result);
          setTimeout(() => { if (!cancelled) setExprVisible(true); }, 80);
        }
      } catch {
        if (!cancelled) setExprVisible(true);
      }
    }

    runDetect();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const expression = exprResult?.expression ?? "neutral";
    const config = EXPRESSION_CONFIG[expression];
    const delay = exprResult ? 100 : 1500;
    const speakTimer = setTimeout(() => { speak(config.speech(displayName)); }, delay);
    return () => clearTimeout(speakTimer);
  }, [exprResult, displayName]);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 3200);
    const doneTimer = setTimeout(() => onDoneRef.current(), 3750);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const expression = exprResult?.expression ?? "neutral";
  const cfg = EXPRESSION_CONFIG[expression];

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
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(5, 46, 22, 0.90)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "18%",
          left: "12%",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 70%)`,
          filter: "blur(50px)",
          pointerEvents: "none",
          transition: "background 0.8s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          right: "10%",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 70%)`,
          filter: "blur(35px)",
          pointerEvents: "none",
          transition: "background 0.8s ease",
        }}
      />

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
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: `1.5px solid ${cfg.rippleColor}`,
              animation: "wRipple 2.4s ease-out 0.8s infinite",
              transition: "border-color 0.6s ease",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: `1px solid ${cfg.rippleColor.replace("0.4", "0.22")}`,
              animation: "wRipple 2.4s ease-out 1.35s infinite",
              transition: "border-color 0.6s ease",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 70%)`,
              filter: "blur(14px)",
              transition: "background 0.6s ease",
            }}
          />
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
              boxShadow: `0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(255,255,255,0.1)`,
              animation: "wIconIn 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s both",
              overflow: "hidden",
            }}
          >
            <Leaf
              style={{
                width: 46,
                height: 46,
                color: cfg.accentColor,
                position: "absolute",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                opacity: exprVisible ? 0 : 1,
                transform: exprVisible ? "scale(0.6)" : "scale(1)",
              }}
            />
            <span
              style={{
                fontSize: 40,
                lineHeight: 1,
                position: "absolute",
                transition: "opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s",
                opacity: exprVisible ? 1 : 0,
                transform: exprVisible ? "scale(1)" : "scale(1.4)",
              }}
            >
              {cfg.emoji}
            </span>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            animation: "wTextIn 0.55s ease-out 0.48s both",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 12px",
              borderRadius: 20,
              background: exprVisible ? `${cfg.accentColor}22` : "transparent",
              border: exprVisible
                ? `1px solid ${cfg.accentColor}44`
                : "1px solid transparent",
              marginBottom: 14,
              transition: "all 0.5s ease",
            }}
          >
            <span
              style={{
                color: exprVisible ? cfg.accentColor : "rgba(187,247,208,0.72)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                transition: "color 0.5s ease",
              }}
            >
              {exprVisible ? cfg.badge : "\u6b22\u8fce\u56de\u6765"}
            </span>
          </div>

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

          <div
            style={{
              color: exprVisible ? "rgba(255,255,255,0.85)" : "rgba(187,247,208,0.6)",
              fontSize: exprVisible ? 15 : 13,
              fontWeight: exprVisible ? 500 : 400,
              letterSpacing: "0.01em",
              marginBottom: exprVisible ? 4 : 0,
              transition: "all 0.5s ease",
              minHeight: 22,
            }}
          >
            {exprVisible ? cfg.greeting : "\u667a\u6167\u519c\u4e1a\u7ba1\u7406\u7cfb\u7edf"}
          </div>

          {exprVisible && (
            <div
              style={{
                color: "rgba(187,247,208,0.55)",
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: "0.02em",
                animation: "wTextIn 0.4s ease-out both",
              }}
            >
              {cfg.detail}
            </div>
          )}
        </div>

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
              background: `linear-gradient(90deg, ${cfg.accentColor}, ${cfg.accentColor}bb, ${cfg.accentColor})`,
              backgroundSize: "200% 100%",
              animation:
                "wProgress 2.8s ease-out 0.8s both, wProgressShimmer 1.5s ease-in-out 1s infinite",
              transition: "background 0.6s ease",
            }}
          />
        </div>

        {exprVisible && exprResult && exprResult.expression !== "neutral" && (
          <div
            style={{
              marginTop: 16,
              color: `${cfg.accentColor}88`,
              fontSize: 10,
              letterSpacing: "0.1em",
              animation: "wTextIn 0.4s ease-out 0.1s both",
            }}
          >
            {"\u8868\u60c5\u8bc6\u522b \u00b7 "}{Math.round(exprResult.confidence * 100)}{"% \u7f6e\u4fe1\u5ea6"}
          </div>
        )}
      </div>
    </div>
  );
}
