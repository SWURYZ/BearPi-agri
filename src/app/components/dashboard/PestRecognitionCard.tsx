import { useEffect, useRef, useState } from "react";
import { Bug, Smartphone, RefreshCw, Sparkles, X, Radio, Copy, Check } from "lucide-react";
import {
  fetchLatestInsectResult,
  clearLatestInsectResult,
  type InsectLatestResult,
} from "../../services/insectRecognition";
import { streamAgriAgentChat } from "../../services/agriAgent";

/**
 * 总览大屏 · 害虫识别卡片（NFC 版）
 * - 通过 NFC 把 Flask 上传页 URL 推送给手机（Web NFC 写卡 / NT3H 标签）
 * - 自动轮询最新识别结果
 * - 拿到害虫名后自动询问精灵芽芽防治方案
 */
export function PestRecognitionCard() {
  const [mobileUrl] = useState(() => {
    const host = window.location.hostname || "localhost";
    return `http://${host}:5000/`;
  });

  const [latest, setLatest] = useState<InsectLatestResult | null>(null);
  const lastTimestampRef = useRef<number>(0);

  const [agentText, setAgentText] = useState<string>("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [nfcSupported] = useState<boolean>(typeof window !== "undefined" && "NDEFReader" in window);
  const [nfcStatus, setNfcStatus] = useState<"idle" | "writing" | "ok" | "fail">("idle");
  const [nfcMsg, setNfcMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const data = await fetchLatestInsectResult();
      if (!alive || !data) return;
      if (data.consumed) return;
      if (data.timestamp <= lastTimestampRef.current) return;
      lastTimestampRef.current = data.timestamp;
      setLatest(data);
      setShowResult(true);
      askAgent(data.top1_name_zh || data.top1_name_en);
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
          question: `大棚里发现了「${pestName}」这种害虫，请给出针对性的防治方案，包括：1）危害症状识别 2）化学防治推荐药剂 3）生物防治措施 4）日常预防建议。请条理清晰，不超过300字。`,
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

  const writeNfc = async () => {
    if (!nfcSupported) {
      setNfcStatus("fail");
      setNfcMsg("当前浏览器不支持 Web NFC，请用 Android Chrome");
      return;
    }
    try {
      setNfcStatus("writing");
      setNfcMsg("请将手机/NFC 标签靠近 NFC 读写器…");
      // @ts-expect-error Web NFC 浏览器实验性 API
      const ndef = new window.NDEFReader();
      await ndef.write({ records: [{ recordType: "url", data: mobileUrl }] });
      setNfcStatus("ok");
      setNfcMsg("NFC 写入成功，手机靠近即可打开");
    } catch (err) {
      setNfcStatus("fail");
      setNfcMsg(`NFC 写入失败：${err instanceof Error ? err.message : "未知错误"}`);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mobileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm relative overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center flex-shrink-0">
            <Bug className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">害虫识别</h3>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">NFC 触碰 · AI 识别 · 智能防治</p>
          </div>
        </div>
        {showResult && (
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 text-xs flex items-center gap-1 flex-shrink-0"
            title="清除当前结果"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      {!showResult ? (
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="relative flex items-center justify-center py-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md">
                <Radio className="w-7 h-7 text-white" />
              </div>
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40" />
              <span className="absolute -inset-2 rounded-full border border-emerald-300 animate-ping opacity-20" style={{ animationDelay: "0.5s" }} />
            </div>
          </div>

          <div className="text-[11px] text-gray-600 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <Smartphone className="w-3.5 h-3.5" />
              <span>手机靠近 NFC 标签</span>
            </div>
            <p className="text-gray-500 leading-snug text-[11px]">
              触碰后浏览器自动打开拍照页，识别结果将在此卡片<strong className="text-emerald-700">自动展示</strong>。
            </p>

            <div className="flex items-center gap-1 bg-gray-50 rounded border border-gray-200 px-2 py-1">
              <code className="flex-1 text-[10px] text-gray-700 truncate" title={mobileUrl}>{mobileUrl}</code>
              <button onClick={copyUrl} className="text-emerald-600 hover:text-emerald-700 flex-shrink-0" title="复制链接">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <button
              onClick={writeNfc}
              disabled={nfcStatus === "writing"}
              className="w-full px-2 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              title={nfcSupported ? "调用 Web NFC 写入" : "浏览器不支持，请到 NT3H 标签预烧录"}
            >
              <Radio className="w-3 h-3" />
              {nfcStatus === "writing" ? "写入中…" : "写入 NFC 标签"}
            </button>

            {nfcStatus !== "idle" && (
              <div
                className={`text-[10px] leading-tight ${
                  nfcStatus === "ok" ? "text-emerald-600" : nfcStatus === "fail" ? "text-red-500" : "text-gray-500"
                }`}
              >
                {nfcMsg}
              </div>
            )}
            {!nfcSupported && nfcStatus === "idle" && (
              <div className="text-[10px] text-gray-400 leading-tight">
                提示：BearPi 板载 NT3H 标签可预烧录此 URL，手机靠近即跳转。
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          {latest && (
            <div className="flex items-start gap-2">
              {latest.image_url && (
                <img
                  src={latest.image_url}
                  alt={latest.top1_name_zh}
                  className="w-14 h-14 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-400">识别结果</div>
                <div className="text-sm font-bold text-emerald-700 truncate">
                  {latest.top1_name_zh || latest.top1_name_en}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {latest.top1_name_en} · {(latest.top1_conf * 100).toFixed(1)}%
                </div>
              </div>
              <button onClick={dismiss} className="text-gray-400 hover:text-red-500 flex-shrink-0" title="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-lg p-2.5 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 mb-1 flex-shrink-0">
              <Sparkles className={`w-3.5 h-3.5 ${agentLoading ? "animate-pulse" : ""}`} />
              <span>精灵芽芽 · 防治方案</span>
              {agentLoading && <span className="text-emerald-500 text-[10px]">生成中…</span>}
            </div>
            <div className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1">
              {agentText || (agentLoading ? "正在分析…" : "等待精灵芽芽响应…")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
