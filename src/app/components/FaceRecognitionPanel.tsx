import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Video, X, UserPlus, ScanFace, Loader2, CheckCircle2, XCircle, Users, Trash2 } from "lucide-react";
import {
  registerFace,
  recognizeFace,
  listFaceRecords,
  deleteFaceRecord,
  type FaceRecognizeResponse,
  type FaceRecordInfo,
} from "../services/faceRecognition";

type Mode = "idle" | "camera" | "registering" | "recognizing" | "video-recognizing" | "result" | "manage";

interface Props {
  /** 识别成功后回调，传回人员姓名 */
  onRecognized?: (personName: string, similarity: number) => void;
}

export function FaceRecognitionPanel({ onRecognized }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameraAction, setCameraAction] = useState<"register" | "recognize">("recognize");
  const [registerName, setRegisterName] = useState("");
  const [recognizeResult, setRecognizeResult] = useState<FaceRecognizeResponse | null>(null);
  const [records, setRecords] = useState<FaceRecordInfo[]>([]);
  const [processing, setProcessing] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("正在扫描人脸...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRecogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRecogBusyRef = useRef(false);

  // 打开摄像头
  const openCamera = useCallback(async (action: "register" | "recognize") => {
    setError(null);
    setCameraAction(action);
    setRecognizeResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setError("无法访问摄像头，请检查浏览器权限设置");
    }
  }, []);

  // 关闭摄像头
  const closeCamera = useCallback(() => {
    if (videoRecogTimerRef.current) {
      clearInterval(videoRecogTimerRef.current);
      videoRecogTimerRef.current = null;
    }
    videoRecogBusyRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMode("idle");
    setError(null);
    setScanStatus("正在扫描人脸...");
  }, []);

  // 拍照获取 Blob
  const capturePhoto = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) { resolve(null); return; }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }, []);

  // 开始视频实时识别
  const startVideoRecognition = useCallback(async () => {
    setError(null);
    setRecognizeResult(null);
    setScanStatus("正在扫描人脸...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("video-recognizing");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });

      // 每 2 秒自动截帧识别
      videoRecogTimerRef.current = setInterval(async () => {
        if (videoRecogBusyRef.current) return;
        videoRecogBusyRef.current = true;
        try {
          const blob = await new Promise<Blob | null>((resolve) => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) { resolve(null); return; }
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
          });
          if (!blob) { videoRecogBusyRef.current = false; return; }

          setScanStatus("比对中...");
          const result = await recognizeFace(blob);

          if (result.matched && result.personName) {
            // 识别成功，停止扫描
            if (videoRecogTimerRef.current) {
              clearInterval(videoRecogTimerRef.current);
              videoRecogTimerRef.current = null;
            }
            setRecognizeResult(result);
            setMode("result");
            // 关闭摄像头
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            onRecognized?.(result.personName, result.similarity);
          } else {
            setScanStatus(`未匹配 (${(result.similarity * 100).toFixed(0)}%)，继续扫描...`);
          }
        } catch {
          setScanStatus("识别请求失败，重试中...");
        } finally {
          videoRecogBusyRef.current = false;
        }
      }, 2000);
    } catch {
      setError("无法访问摄像头，请检查浏览器权限设置");
    }
  }, [capturePhoto, onRecognized]);

  // 拍照并注册
  const handleCapture = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      const blob = await capturePhoto();
      if (!blob) { setError("拍照失败"); return; }

      if (cameraAction === "recognize") {
        setMode("recognizing");
        const result = await recognizeFace(blob);
        setRecognizeResult(result);
        setMode("result");
        if (result.matched && result.personName) {
          onRecognized?.(result.personName, result.similarity);
        }
      } else {
        if (!registerName.trim()) { setError("请输入姓名"); return; }
        setMode("registering");
        await registerFace(blob, registerName.trim());
        closeCamera();
        setRegisterName("");
        setMode("idle");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
      setMode("camera");
    } finally {
      setProcessing(false);
    }
  }, [capturePhoto, cameraAction, registerName, closeCamera, onRecognized]);

  // 管理面板
  const openManage = useCallback(async () => {
    setMode("manage");
    setError(null);
    try {
      const list = await listFaceRecords();
      setRecords(list);
    } catch {
      setError("获取记录失败");
    }
  }, []);

  const handleDelete = useCallback(async (personId: string) => {
    try {
      await deleteFaceRecord(personId);
      setRecords((prev) => prev.filter((r) => r.personId !== personId));
    } catch {
      setError("删除失败");
    }
  }, []);

  // 清理摄像头
  useEffect(() => {
    return () => {
      if (videoRecogTimerRef.current) clearInterval(videoRecogTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl overflow-hidden">
      {/* 隐藏的 canvas 用于拍照 */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-100">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium text-violet-700">人脸识别</span>
        </div>
        {mode !== "idle" && (
          <button
            onClick={() => { closeCamera(); setMode("idle"); setRecognizeResult(null); }}
            className="p-1 text-violet-400 hover:text-violet-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 空闲态 - 操作按钮 */}
      {mode === "idle" && (
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={startVideoRecognition}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Video className="w-4 h-4" />
            视频识别
          </button>
          <button
            onClick={() => openCamera("register")}
            className="flex items-center gap-2 px-4 py-2 bg-white text-violet-600 text-sm border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            注册人脸
          </button>
          <button
            onClick={openManage}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="w-4 h-4" />
            管理
          </button>
        </div>
      )}

      {/* 视频实时识别 */}
      {mode === "video-recognizing" && (
        <div className="p-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-64 mx-auto">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* 人脸扫描动画框 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-52 border-2 border-violet-400 rounded-[40%] animate-pulse" />
              {/* 扫描线动画 */}
              <div className="absolute w-40 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            {/* 状态栏 */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white">{scanStatus}</span>
            </div>
          </div>
          <button
            onClick={closeCamera}
            className="mt-3 w-full py-2 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors"
          >
            停止识别
          </button>
          <style>{`
            @keyframes scan {
              0%, 100% { transform: translateY(-60px); opacity: 0.3; }
              50% { transform: translateY(60px); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* 摄像头预览（注册模式） */}
      {(mode === "camera" || mode === "registering") && (
        <div className="p-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-64 mx-auto">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* 人脸框参考线 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-52 border-2 border-dashed border-white/50 rounded-[40%]" />
            </div>
            {mode === "registering" && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="flex items-center gap-2 text-white">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">正在注册...</span>
                </div>
              </div>
            )}
          </div>

          {/* 注册模式需要输入姓名 */}
          {mode === "camera" && (
            <input
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              placeholder="请输入姓名"
              className="mt-3 w-full px-3 py-2 text-sm border border-violet-200 rounded-lg outline-none focus:border-violet-400 bg-white"
            />
          )}

          {mode === "camera" && (
            <div className="mt-3 flex items-center justify-center">
              <button
                onClick={handleCapture}
                disabled={processing || !registerName.trim()}
                className="px-6 py-2.5 bg-violet-600 text-white text-sm rounded-full hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md"
              >
                <Camera className="w-4 h-4" />
                拍照注册
              </button>
            </div>
          )}
        </div>
      )}

      {/* 识别结果 */}
      {mode === "result" && recognizeResult && (
        <div className="p-4">
          {recognizeResult.matched ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700">
                  识别成功：{recognizeResult.personName}
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  相似度：{(recognizeResult.similarity * 100).toFixed(1)}% （阈值：{(recognizeResult.threshold * 100).toFixed(0)}%）
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <XCircle className="w-8 h-8 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-700">未能识别</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  最高相似度：{(recognizeResult.similarity * 100).toFixed(1)}%，未达到阈值 {(recognizeResult.threshold * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => { setMode("idle"); setRecognizeResult(null); }}
            className="mt-3 w-full py-2 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors"
          >
            返回
          </button>
        </div>
      )}

      {/* 管理面板 */}
      {mode === "manage" && (
        <div className="p-4">
          {records.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无已注册人脸</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {records.map((r) => (
                <div
                  key={r.personId}
                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">{r.personName}</p>
                    <p className="text-xs text-gray-400">ID: {r.personId}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(r.personId)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}
    </div>
  );
}
