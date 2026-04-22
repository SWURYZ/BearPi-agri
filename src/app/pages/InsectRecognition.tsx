import { useEffect, useRef, useState } from "react";
import { Bug, Camera, Upload, RefreshCw, Sparkles, Volume2, VolumeX } from "lucide-react";
import {
  uploadInsectImage,
  type InsectUploadResult,
} from "../services/insectRecognition";
import { streamAgriAgentChat } from "../services/agriAgent";
import { speak, stopSpeaking, isTTSSupported } from "../lib/speech";

/**
 * 害虫识别页 - 移动端优先
 * - 支持调用相机直接拍照(input capture="environment")
 * - 也支持从相册选图
 * - 上传 → /api/insect/upload (Flask) → 显示 Top-5
 * - 拿到害虫名后流式调用精灵芽芽，给出防治方案 + TTS 朗读
 */
export function InsectRecognition() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<InsectUploadResult | null>(null);

  const [agentText, setAgentText] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);

  const ttsSupported = isTTSSupported();
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  // 释放上次的 ObjectURL，避免内存泄漏
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    setError("");
    setResult(null);
    setAgentText("");
    stopSpeaking();
    setSpeaking(false);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    setUploading(true);
    try {
      const data = await uploadInsectImage(file);
      setResult(data);
      const pestName = data.top1_name_zh || data.top1_name_en;
      if (pestName) askAgent(pestName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "识别失败");
    } finally {
      setUploading(false);
    }
  };

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
      if (ttsEnabled && acc.trim() && ttsSupported) {
        setSpeaking(true);
        speak(`检测到害虫${pestName}。${acc}`).finally(() =>
          setSpeaking(false),
        );
      }
    } catch (err) {
      setAgentText(`查询失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setAgentLoading(false);
    }
  };

  const toggleTts = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    }
    setTtsEnabled((v) => !v);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setAgentText("");
    setError("");
    stopSpeaking();
    setSpeaking(false);
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-emerald-50 to-white">
      {/* 头部 */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
            <Bug className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-semibold text-gray-900">害虫识别</div>
            <div className="text-xs sm:text-sm text-gray-500">拍照即可识别 102 种常见农业害虫</div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-2xl mx-auto pb-24">
        {/* 拍照 / 上传按钮 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-emerald-500 text-white shadow-md active:scale-95 transition disabled:opacity-60 disabled:active:scale-100"
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm font-medium">拍照识别</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-white text-emerald-600 border border-emerald-200 shadow-sm active:scale-95 transition disabled:opacity-60 disabled:active:scale-100"
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">从相册选择</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* 预览 + 识别状态 */}
        {previewUrl && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="relative bg-gray-100 aspect-square sm:aspect-video">
              <img
                src={previewUrl}
                alt="预览"
                className="w-full h-full object-contain"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  识别中...
                </div>
              )}
            </div>
            <div className="p-3 flex items-center justify-between text-xs text-gray-500">
              <span>{uploading ? "等待识别结果" : result ? "识别完成" : "未识别"}</span>
              <button
                type="button"
                onClick={reset}
                className="text-emerald-600 hover:underline"
              >
                重新选择
              </button>
            </div>
          </div>
        )}

        {/* Top-5 识别结果 */}
        {result && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-900">识别结果</div>
              <div className="text-xs text-gray-400">
                置信度 {(result.top1_conf * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 mb-1 break-all">
              {result.top1_name_zh || result.top1_name_en}
            </div>
            <div className="text-xs text-gray-400 mb-4 break-all">
              {result.top1_name_en}
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-500 mb-1">Top-5 候选</div>
              {result.top5_rows.map((row, i) => (
                <div key={`${row.class_en}-${i}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate flex-1 mr-2">
                      {i + 1}. {row.class_zh || row.class_en}
                    </span>
                    <span className="text-gray-400 tabular-nums">
                      {row.percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, row.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI 防治方案 */}
        {(agentLoading || agentText) && (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Sparkles className="w-4 h-4" />
                精灵芽芽 · 防治方案
              </div>
              {ttsSupported && (
                <button
                  type="button"
                  onClick={toggleTts}
                  className={`p-1.5 rounded-lg ${
                    ttsEnabled ? "text-emerald-600" : "text-gray-400"
                  } hover:bg-white/60`}
                  title={ttsEnabled ? "关闭朗读" : "开启朗读"}
                >
                  {ttsEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[3em]">
              {agentText ||
                (agentLoading ? "正在生成防治方案..." : "")}
            </div>
            {agentLoading && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>生成中...</span>
              </div>
            )}
          </div>
        )}

        {/* 空状态提示 */}
        {!previewUrl && !result && (
          <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-white/60 p-6 text-center">
            <Bug className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
            <div className="text-sm text-gray-600 mb-1">
              请使用上方按钮拍照或选择一张害虫图片
            </div>
            <div className="text-xs text-gray-400">
              支持 JPG / PNG / HEIC 格式
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
