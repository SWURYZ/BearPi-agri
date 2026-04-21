import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Bug, Smartphone, RefreshCw, Sparkles, X } from "lucide-react";
import {
  fetchLatestInsectResult,
  clearLatestInsectResult,
  type InsectLatestResult,
} from "../../services/insectRecognition";
import { streamAgriAgentChat } from "../../services/agriAgent";

/**
 * 总览大屏 · 害虫识别卡片
 * - 显示二维码（指向 Flask 5000 服务，手机扫码后拍照上传）
 * - 自动轮询最新识别结果
 * - 拿到害虫名后自动询问精灵芽芽防治方案
 */
export function PestRecognitionCard() {
  // Use the host the Dashboard is currently served from, but force the Flask port.
  // 这样手机扫码能访问到 PC 的局域网 IP，前提是 PC 防火墙放行 5000 端口。
  const [mobileUrl] = useState(() => {
    const host = window.location.hostname || "localhost";
    return `http://${host}:5000/`;
  });

  const [latest, setLatest] = useState<InsectLatestResult | null>(null);
  const lastTimestampRef = useRef<number>(0);

  const [agentText, setAgentText] = useState<string>("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Poll the latest result every 3 seconds
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const data = await fetchLatestInsectResult();
      if (!alive || !data) return;

      // Only react to a fresh, unconsumed result
      if (data.consumed) return;
      if (data.timestamp <= lastTimestampRef.current) return;
      lastTimestampRef.current = data.timestamp;
      setLatest(data);
      setShowResult(true);

      // Auto-ask 精灵芽芽 about treatment plan
      askAgent(data.top1_name_zh || data.top1_name_en);
      // Mark as consumed so we don't retrigger
      clearLatestInsectResult();
    };

    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const askAgent = async (pestName: string) => {
    setAgentLoading(true);
    setAgentText("");
    let acc = "";
    try {
      await streamAgriAgentChat(
        {
          question: `大棚里发现了「${pestName}」这种害虫，请给出针对性的防治方案，包括：1）危害症状识别 2）化学防治推荐药剂 3）生物防治措施 4）日常预防建议。请用条理清晰的方式回答，不超过300字。`,
        },
        {
          onToken: (t) => {
            acc += t;
            setAgentText(acc);
          },
          onError: (msg) => {
            setAgentText(`抱歉，精灵芽芽暂时无法响应：${msg}`);
          },
        },
      );
    } catch (err) {
      setAgentText(`查询失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setAgentLoading(false);
    }
  };

  const dismiss = () => {
    setShowResult(false);
    setLatest(null);
    setAgentText("");
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
            <Bug className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">害虫识别</h3>
            <p className="text-xs text-gray-400 mt-0.5">手机扫码 · AI 识别 · 智能防治</p>
          </div>
        </div>
        {latest && (
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 text-xs flex items-center gap-1"
            title="清除当前结果"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      {!showResult ? (
        // ── QR code state ──
        <div className="flex items-center gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-inner">
            <QRCodeSVG
              value={mobileUrl}
              size={120}
              level="M"
              bgColor="#ffffff"
              fgColor="#065f46"
            />
          </div>
          <div className="flex-1 text-xs text-gray-600 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <Smartphone className="w-3.5 h-3.5" />
              <span>请用手机扫描二维码</span>
            </div>
            <p className="text-gray-500 leading-relaxed">
              扫码后用手机拍摄发现的害虫，识别完成后，本卡片将<strong className="text-emerald-700">自动展示</strong>害虫名称及精灵芽芽给出的防治建议。
            </p>
            <a
              href={mobileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-emerald-600 hover:text-emerald-700 underline text-xs"
            >
              {mobileUrl}
            </a>
          </div>
        </div>
      ) : (
        // ── Result + agent advice state ──
        <div className="space-y-3">
          {latest && (
            <div className="flex items-start gap-3">
              {latest.image_url && (
                <img
                  src={latest.image_url}
                  alt={latest.top1_name_zh}
                  className="w-20 h-20 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 mb-0.5">识别结果</div>
                <div className="text-base font-bold text-emerald-700 truncate">
                  {latest.top1_name_zh || latest.top1_name_en}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {latest.top1_name_en} · 置信度 {(latest.top1_conf * 100).toFixed(1)}%
                </div>
              </div>
              <button
                onClick={dismiss}
                className="text-gray-400 hover:text-red-500"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1.5">
              <Sparkles className={`w-3.5 h-3.5 ${agentLoading ? "animate-pulse" : ""}`} />
              <span>精灵芽芽 · 防治方案</span>
              {agentLoading && <span className="text-emerald-500 text-[10px]">生成中…</span>}
            </div>
            <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {agentText || (agentLoading ? "正在分析…" : "等待精灵芽芽响应…")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
