import { useEffect, useRef, useState } from "react";
import {
  Bug,
  Leaf,
  Smartphone,
  RefreshCw,
  Sparkles,
  X,
  Radio,
  Copy,
  Check,
  Volume2,
  VolumeX,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  fetchLatestInsectResult,
  clearLatestInsectResult,
  type InsectLatestResult,
} from "../../services/insectRecognition";
import { streamAgriAgentChat } from "../../services/agriAgent";
import { speak, stopSpeaking, isTTSSupported, isSpeaking } from "../../lib/speech";

// 向全局漂浮芽芽发送说话指令
function triggerYayaSpeak(text: string, userText?: string) {
  window.dispatchEvent(
    new CustomEvent("yaya:speak", {
      detail: { text, userText, openPanel: true },
    }),
  );
}
function triggerYayaStop() {
  window.dispatchEvent(new Event("yaya:stop"));
}

/**
 * 总览大屏 · 病虫害识别大卡片（NFC + 二维码 双入口）
 * 左侧：NFC 写入 / 二维码扫码
 * 右侧：识别结果（害虫 / 植物病害） + 精灵芽芽流式防治方案 + TTS 播报
 */
export function PestRecognitionCard() {
  const [mobileUrl] = useState(() => {
    // 手机端二维码 / NFC 直接进入 React 主站的「害虫识别」页面
    // 优先使用 VITE_PEST_HOST（可含 host:port 或域名），否则沿用当前 hostname
    // 生产部署到公网时，建议在 .env 中配置 VITE_PEST_HOST=yourdomain.com
    const rawEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    const envHost = rawEnv?.VITE_PEST_HOST;
    const { protocol, hostname, port } = window.location;
    if (envHost) {
      // 允许传入 host 或 host:port 或完整 URL
      if (envHost.startsWith("http")) return `${envHost.replace(/\/$/, "")}/insect`;
      return `${protocol}//${envHost}/insect`;
    }
    const host = hostname || "localhost";
    const suffix = port ? `:${port}` : "";
    return `${protocol}//${host}${suffix}/insect`;
  });

  const [latest, setLatest] = useState<InsectLatestResult | null>(null);
  const lastTimestampRef = useRef<number>(0);

  const [agentText, setAgentText] = useState<string>("");
  const [agentLoading, setAgentLoading] = useState(false);

  const [entry, setEntry] = useState<"nfc" | "qr">("qr");
  const [nfcSupported] = useState<boolean>(typeof window !== "undefined" && "NDEFReader" in window);
  const [nfcStatus, setNfcStatus] = useState<"idle" | "writing" | "ok" | "fail">("idle");
  const [nfcMsg, setNfcMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const ttsSupported = isTTSSupported();
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const data = await fetchLatestInsectResult();
      if (!alive || !data) return;
      if (data.consumed) return;
      if (data.timestamp <= lastTimestampRef.current) return;
      lastTimestampRef.current = data.timestamp;
      setLatest(data);
      // 直接传 kind，避免读取未刷新的 latest state
      askAgent(data.top1_name_zh || data.top1_name_en, data.kind === "plant" ? "plant" : "insect");
      clearLatestInsectResult();
    };

    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const askAgent = async (pestName: string, kind: "insect" | "plant" = "insect") => {
    setAgentLoading(true);
    setAgentText("");
    let acc = "";
    const isPlant = kind === "plant";
    const question = isPlant
      ? `检测到大棚植株出现「${pestName}」。请给出详细的处理建议：若为健康叶片，请说明其生长状态良好并给出后期养护要点；若为病害，则包括：1）病状识别要点 2）应急处理措施（隔离、修剪、是否需要拔除） 3）化学防治推荐药剂与用量 4）生物/生态防治方法 5）后期预防要点。请条理清晰，不超过300字。`
      : `大棚里发现了「${pestName}」这种害虫，请给出针对性的防治方案，包括：1）危害症状识别 2）化学防治推荐药剂 3）生物防治措施 4）日常预防建议。请条理清晰，不超过300字。`;
    const prefix = isPlant ? `检测到植物状况：${pestName}。` : `检测到害虫：${pestName}。`;
    const userText = isPlant
      ? `帮我分析植物「${pestName}」的养护与防治建议`
      : `帮我分析害虫「${pestName}」的防治方案`;
    try {
      await streamAgriAgentChat(
        { question },
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
      if (ttsEnabled && acc.trim()) {
        setSpeaking(true);
        // 优先走全局漂浮芽芽，避免两处同时说话
        const summary = `${prefix}${acc}`;
        triggerYayaSpeak(summary, userText);
        // 本地状态在下一轮流式启动时重置；这里粗略估计一个播报时长
        const estMs = Math.min(60_000, Math.max(4000, summary.length * 180));
        window.setTimeout(() => setSpeaking(false), estMs);
      }
    } catch (err) {
      setAgentText(`查询失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setAgentLoading(false);
    }
  };

  const toggleTts = () => {
    if (speaking || isSpeaking()) {
      triggerYayaStop();
      stopSpeaking();
      setSpeaking(false);
      setTtsEnabled(false);
    } else {
      setTtsEnabled((v) => !v);
    }
  };

  const replaySpeak = () => {
    if (!agentText.trim()) return;
    triggerYayaStop();
    stopSpeaking();
    setSpeaking(true);
    setTtsEnabled(true);
    const isPlant = latest?.kind === "plant";
    const target = latest?.top1_name_zh || latest?.top1_name_en || "";
    const prefix = target ? (isPlant ? `检测到植物问题${target}。` : `检测到害虫${target}。`) : "";
    const summary = `${prefix}${agentText}`;
    const userText = target
      ? (isPlant ? `重新讲一次植物病害「${target}」的处理方案` : `重新讲一次「${target}」的防治方案`)
      : undefined;
    triggerYayaSpeak(summary, userText);
    const estMs = Math.min(60_000, Math.max(4000, summary.length * 180));
    window.setTimeout(() => setSpeaking(false), estMs);
  };

  const dismiss = () => {
    triggerYayaStop();
    stopSpeaking();
    setSpeaking(false);
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

  const hasResult = !!latest;
  const isPlantResult = latest?.kind === "plant";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 bg-gradient-to-br ${isPlantResult ? "from-green-400 to-lime-600" : "from-emerald-400 to-green-600"}`}>
            {isPlantResult ? <Leaf className="w-5 h-5 text-white" /> : <Bug className="w-5 h-5 text-white" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-800">病虫害识别 · 智能防治</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">手机拍照识别害虫/植物病害 · AI 识别 · 精灵芽芽自动给出防治方案</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setEntry("qr")}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                entry === "qr" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
              }`}
            >
              <QrCode className="w-3 h-3" /> 二维码
            </button>
            <button
              onClick={() => setEntry("nfc")}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                entry === "nfc" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
              }`}
            >
              <Radio className="w-3 h-3" /> NFC
            </button>
          </div>
          {hasResult && (
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-gray-600 text-xs p-1 rounded hover:bg-gray-100"
              title="清除当前结果"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body: 左侧入口 + 右侧识别结果 */}
      <div className="flex-1 grid grid-cols-5 gap-4 min-h-0">
        {/* ========== 左侧：登录入口 ========== */}
        <div className="col-span-2 bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 border border-emerald-100 rounded-xl p-3 flex flex-col">
          {entry === "qr" ? (
            <>
              <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 mb-2 flex-shrink-0">
                <QrCode className="w-3.5 h-3.5" />
                <span>扫码登录拍照</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-white p-2.5 rounded-lg shadow-md border border-emerald-100">
                  <QRCodeSVG
                    value={mobileUrl}
                    size={140}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#047857"
                    includeMargin={false}
                  />
                </div>
              </div>
              <div className="text-[10px] text-gray-500 text-center mt-2 leading-snug">
                <Smartphone className="w-3 h-3 inline mr-0.5" />
                微信/相机扫一扫，跳转上传页
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 mb-2 flex-shrink-0">
                <Radio className="w-3.5 h-3.5" />
                <span>NFC 触碰登录</span>
              </div>
              <div className="flex-1 flex items-center justify-center relative">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Radio className="w-10 h-10 text-white" />
                  </div>
                  <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40" />
                  <span
                    className="absolute -inset-3 rounded-full border border-emerald-300 animate-ping opacity-20"
                    style={{ animationDelay: "0.5s" }}
                  />
                </div>
              </div>
              <button
                onClick={writeNfc}
                disabled={nfcStatus === "writing"}
                className="w-full mt-2 px-2 py-1.5 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Radio className="w-3 h-3" />
                {nfcStatus === "writing" ? "写入中…" : "写入 NFC 标签"}
              </button>
              {nfcStatus !== "idle" && (
                <div
                  className={`text-[10px] leading-tight mt-1 text-center ${
                    nfcStatus === "ok" ? "text-emerald-600" : nfcStatus === "fail" ? "text-red-500" : "text-gray-500"
                  }`}
                >
                  {nfcMsg}
                </div>
              )}
              {!nfcSupported && nfcStatus === "idle" && (
                <div className="text-[10px] text-gray-400 leading-tight mt-1 text-center">
                  BearPi 板载 NT3H 已预烧录
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-1 bg-white rounded border border-emerald-100 px-2 py-1 mt-2 flex-shrink-0">
            <code className="flex-1 text-[10px] text-gray-700 truncate" title={mobileUrl}>
              {mobileUrl}
            </code>
            <button
              onClick={copyUrl}
              className="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
              title="复制链接"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* ========== 右侧：识别结果 + 精灵芽芽 ========== */}
        <div className="col-span-3 flex flex-col min-h-0 gap-2">
          {hasResult ? (
            <>
              <div className="flex items-center gap-3 bg-white border border-emerald-100 rounded-lg p-2.5 flex-shrink-0">
                {latest?.image_url && (
                  <img
                    src={latest.image_url}
                    alt={latest.top1_name_zh}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-400 flex items-center gap-1">
                    <span>识别结果</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isPlantResult ? "bg-lime-100 text-lime-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {isPlantResult ? "植物病害" : "害虫"}
                    </span>
                  </div>
                  <div className={`text-base font-bold truncate ${isPlantResult ? "text-lime-700" : "text-emerald-700"}`}>
                    {latest?.top1_name_zh || latest?.top1_name_en}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {latest?.top1_name_en} · 置信度 {((latest?.top1_conf || 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0 p-1"
                  title="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-lg p-3 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1.5 flex-shrink-0">
                  <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${agentLoading ? "animate-pulse" : ""}`} />
                  <span className="truncate">精灵芽芽 · 防治方案</span>
                  {agentLoading && <span className="text-emerald-500 text-[10px] flex-shrink-0">生成中…</span>}
                  {speaking && !agentLoading && (
                    <span className="text-emerald-500 text-[10px] flex-shrink-0">📢 芽芽播报中…</span>
                  )}
                  <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                    {ttsSupported && agentText && !agentLoading && (
                      <button
                        onClick={replaySpeak}
                        className="text-emerald-600 hover:text-emerald-700 p-0.5"
                        title="让芽芽重新播报"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                    {ttsSupported && (
                      <button
                        onClick={toggleTts}
                        className={`${ttsEnabled ? "text-emerald-600" : "text-gray-400"} hover:text-emerald-700 p-0.5`}
                        title={ttsEnabled ? (speaking ? "停止芽芽播报" : "已开启语音播报") : "已关闭语音播报"}
                      >
                        {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1">
                  {agentText || (agentLoading ? "正在分析…" : "等待精灵芽芽响应…")}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-lg p-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3 relative">
                <Bug className="w-7 h-7 text-emerald-400 absolute -translate-x-2" />
                <Leaf className="w-7 h-7 text-lime-500 absolute translate-x-2" />
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">等待手机端上传图片</div>
              <p className="text-[11px] text-gray-500 leading-relaxed max-w-[260px]">
                {entry === "qr" ? "微信/相机扫描左侧二维码" : "手机靠近 NFC 标签"}，
                打开拍照页上传<strong className="text-emerald-700">害虫</strong>或<strong className="text-lime-700">植物病害</strong>图片，
                识别结果将<strong className="text-emerald-700">自动展示</strong>并由
                <strong className="text-emerald-700">精灵芽芽</strong>语音播报防治方案。
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                每 3 秒自动检测中…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
