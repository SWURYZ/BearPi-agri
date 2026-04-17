import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Leaf,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  ScanFace,
  Loader2,
  X,
  Sprout,
  Sun,
  Droplets,
  RotateCcw,
} from "lucide-react";
import * as auth from "../services/auth";

type Mode = "login" | "register" | "face-login";

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFirst, setIsFirst] = useState(false);

  /* ---- 人脸识别 ---- */
  const [scanStatus, setScanStatus] = useState("正在扫描人脸...");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    auth.isFirstUser().then(setIsFirst);
    auth.getCurrentUser().then((u) => {
      if (u) navigate("/", { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ---- 系统初始化 ---- */
  const handleReset = async () => {
    if (!confirm("确定要清除所有用户数据并重新注册管理员吗？此操作不可恢复！")) return;
    setError("");
    setLoading(true);
    try {
      await auth.resetSystem();
      setIsFirst(true);
      setMode("register");
    } catch (err) {
      setError(err instanceof Error ? err.message : "初始化失败");
    } finally {
      setLoading(false);
    }
  };

  /* ---- 密码登录 ---- */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  /* ---- 首次注册 ---- */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.register(username, password, displayName);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  /* ---- 人脸登录 ---- */
  const startFaceLogin = useCallback(async () => {
    setError("");
    setScanStatus("正在扫描人脸...");
    setMode("face-login");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });

      timerRef.current = setInterval(async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas) {
            busyRef.current = false;
            return;
          }
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            busyRef.current = false;
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
          );
          if (!blob) {
            busyRef.current = false;
            return;
          }

          setScanStatus("比对中...");
          try {
            await auth.loginByFace(blob);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            navigate("/", { replace: true });
          } catch (loginErr) {
            const msg = loginErr instanceof Error ? loginErr.message : "识别失败";
            if (msg.includes("活体检测")) {
              setScanStatus("⚠️ " + msg);
            } else if (msg.includes("未识别") || msg.includes("未匹配")) {
              setScanStatus("未匹配，继续扫描...");
            } else {
              setScanStatus(msg + "，重试中...");
            }
          }
        } catch {
          setScanStatus("识别服务异常，重试中...");
        } finally {
          busyRef.current = false;
        }
      }, 2000);
    } catch {
      setError("无法访问摄像头，请检查浏览器权限");
      setMode("login");
    }
  }, [navigate]);

  const stopFaceLogin = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    busyRef.current = false;
    setMode("login");
  }, []);

  /* ============================== 渲染 ============================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-green-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl" />
        <Sprout className="absolute top-1/4 left-10 w-32 h-32 text-green-700/20" />
        <Sun className="absolute bottom-1/4 right-10 w-24 h-24 text-green-700/20" />
        <Droplets className="absolute top-1/2 right-1/4 w-20 h-20 text-green-700/15" />
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-400 rounded-2xl shadow-lg shadow-green-500/30 mb-4">
            <Leaf className="w-9 h-9 text-green-900" />
          </div>
          <h1 className="text-2xl font-bold text-white">智慧农业大棚</h1>
          <p className="text-green-300 text-sm mt-1">管理系统 v2.0</p>
        </div>

        {/* 卡片 */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Tab 切换 */}
          {mode !== "face-login" && (
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  mode === "login"
                    ? "text-green-700 border-b-2 border-green-600 bg-green-50/50"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <LogIn className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                登录
              </button>
              {isFirst && (
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                    mode === "register"
                      ? "text-green-700 border-b-2 border-green-600 bg-green-50/50"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <UserPlus className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  初始注册
                </button>
              )}
            </div>
          )}

          <div className="p-6">
            {/* ====== 登录表单 ====== */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    用户名
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    密码
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入密码"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-green-600/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  登录
                </button>

                {/* 分割线 */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-gray-400">或</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startFaceLogin}
                  className="w-full py-2.5 bg-violet-50 text-violet-600 text-sm font-medium rounded-xl border border-violet-200 hover:bg-violet-100 transition-all flex items-center justify-center gap-2"
                >
                  <ScanFace className="w-4 h-4" />
                  人脸识别登录
                </button>

                {isFirst ? (
                  <p className="text-center text-xs text-gray-400">
                    首次使用？
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setError("");
                      }}
                      className="text-green-600 hover:text-green-700 font-medium ml-1"
                    >
                      注册管理员账户
                    </button>
                  </p>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-xs text-gray-400">
                      新用户请联系管理员添加账户
                    </p>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={loading}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      系统初始化（清除所有用户重新注册）
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* ====== 首次注册表单 ====== */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  <strong>首次注册</strong>
                  ：您将成为系统管理员，拥有添加 / 删除用户及人脸管理权限。
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    显示名称
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="例如：张管理"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    用户名
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="至少2个字符"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    密码
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="至少6个字符"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-green-600/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  注册管理员
                </button>

                <p className="text-center text-xs text-gray-400">
                  已有账户？
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="text-green-600 hover:text-green-700 font-medium ml-1"
                  >
                    去登录
                  </button>
                </p>
              </form>
            )}

            {/* ====== 人脸识别登录 ====== */}
            {mode === "face-login" && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* 扫描框 */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-36 h-48 border-2 border-green-400 rounded-[40%] animate-pulse" />
                    <div className="absolute w-36 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                  {/* 状态栏 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-white">{scanStatus}</span>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  onClick={stopFaceLogin}
                  className="w-full py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4 inline mr-1 -mt-0.5" />
                  返回密码登录
                </button>

                <style>{`
                  @keyframes scan {
                    0%, 100% { transform: translateY(-50px); opacity: 0.3; }
                    50% { transform: translateY(50px); opacity: 1; }
                  }
                `}</style>
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <p className="text-center text-green-400/60 text-xs mt-6">
          © 2025 智慧农业大棚管理系统
        </p>
      </div>
    </div>
  );
}
