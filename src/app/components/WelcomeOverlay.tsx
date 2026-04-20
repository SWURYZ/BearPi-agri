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
  /** 浜鸿劯鐧诲綍鏃朵紶鍏ュ凡鎹曡幏鐨?canvas锛屽瘑鐮佺櫥褰曟椂浼?null/undefined锛堝皢灏濊瘯鎽勫儚澶达級 */
  faceCanvas?: HTMLCanvasElement | null;
  onDone: () => void;
}

/**
 * iOS 椋庢牸鐧诲綍娆㈣繋鍔ㄧ敾 + 浜鸿劯琛ㄦ儏鎰熺煡銆?
 *
 * - 鎸傝浇鍗冲紑濮嬭〃鎯呮娴嬶紙妯″瀷浠?CDN 杩滅▼涓嬭浇锛岀害 500 KB锛屾祻瑙堝櫒鑷姩缂撳瓨锛?
 * - 妫€娴嬬粨鏋滃埌杈惧悗浠ヤ釜鎬у寲闂€欒 + TTS 鍛堢幇
 * - 绾?3.5s 鍚庨€€鍑哄苟璺宠浆涓荤晫闈?
 */
export function WelcomeOverlay({ displayName, faceCanvas, onDone }: Props) {
  const [exiting, setExiting] = useState(false);
  const [exprResult, setExprResult] = useState<ExpressionResult | null>(null);
  const [exprVisible, setExprVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // 鈹€鈹€鈹€ 琛ㄦ儏妫€娴?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  useEffect(() => {
    let cancelled = false;

    loadExpressionModels().catch(() => {/* 妯″瀷鍔犺浇澶辫触涓嶉樆鏂祦绋?*/});

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

  // 鈹€鈹€鈹€ TTS 璇煶鎾姤 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  useEffect(() => {
    const expression = exprResult?.expression ?? "neutral";
    const config = EXPRESSION_CONFIG[expression];
    const delay = exprResult ? 100 : 1500;

    const speakTimer = setTimeout(() => {
      speak(config.speech(displayName));
    }, delay);

    return () => clearTimeout(speakTimer);
  }, [exprResult, displayName]);

  // 鈹€鈹€鈹€ 閫€鍦烘椂搴?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 3200);
    const doneTimer = setTimeout(() => onDoneRef.current(), 3750);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
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
      {/* 姣涚幓鐠冭儗鏅?*/}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(5, 46, 22, 0.90)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
        }}
      />

      {/* 鑳屾櫙鍏夋檿锛堥殢琛ㄦ儏鍙樿壊锛?*/}
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

      {/* 涓诲崱鐗囷紙iOS 椋庢牸寮瑰嚭锛?*/}
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
        {/* 鈹€鈹€ 鍥炬爣鍖哄煙锛堝甫鑴夊啿鐜級 鈹€鈹€ */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          {/* 鑴夊啿鐜?1 */}
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
          {/* 鑴夊啿鐜?2 */}
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

          {/* 鍥炬爣鑳屾櫙鍏夋檿 */}
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

          {/* 鍥炬爣涓讳綋锛坕OS 鐜荤拑璐ㄦ劅锛?*/}
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
            {/* 琛ㄦ儏妫€娴嬪墠锛氭樉绀哄彾瀛愬浘鏍囷紱妫€娴嬪悗锛氭贰鍑哄彾瀛愶紝娣″叆 emoji */}
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

        {/* 鈹€鈹€ 鏂囧瓧鍖哄煙 鈹€鈹€ */}
        <div
          style={{
            textAlign: "center",
            animation: "wTextIn 0.55s ease-out 0.48s both",
          }}
        >
          {/* 琛ㄦ儏鏍囩 badge锛堟娴嬪畬鎴愬悗娣″叆锛?*/}
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
              {exprVisible ? cfg.badge : "娆㈣繋鍥炴潵"}
            </span>
          </div>

          {/* 鐢ㄦ埛鍚?*/}
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

          {/* 涓€у寲闂€欒锛堣〃鎯呮娴嬪悗鏇存柊锛?*/}
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
            {exprVisible ? cfg.greeting : "鏅烘収鍐滀笟绠＄悊绯荤粺"}
          </div>

          {/* 琛ュ厖璇存槑锛堜粎鍦ㄨ〃鎯呮娴嬪悗鏄剧ず锛?*/}
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

        {/* 鈹€鈹€ 杩涘害鏉?鈹€鈹€ */}
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

        {/* 鈹€鈹€ 琛ㄦ儏缃俊搴︽寚绀猴紙浠呭湪妫€娴嬪埌鏄庣‘琛ㄦ儏鏃舵樉绀猴級 鈹€鈹€ */}
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
            琛ㄦ儏璇嗗埆 路 {Math.round(exprResult.confidence * 100)}% 缃俊搴?
          </div>
        )}
      </div>
    </div>
  );
}
