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
  Camera,
  AlertTriangle,
  Settings,
  Copy,
} from "lucide-react";
import * as auth from "../services/auth";
import { WelcomeOverlay } from "../components/WelcomeOverlay";

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
  const [welcomeUser, setWelcomeUser] = useState<string | null>(null);
  const [welcomeCanvas, setWelcomeCanvas] = useState<HTMLCanvasElement | null>(null);

  /* ---- 人脸识别 ---- */
  const [scanStatus, setScanStatus] = useState("正在扫描人脸...");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  /* ---- 摄像头权限错误对话框 ---- */
  type CamErrKind = "insecure" | "denied" | "notfound" | "unsupported" | "inuse" | "unknown";
  const [camErr, setCamErr] = useState<{ kind: CamErrKind; raw: string } | null>(null);

  useEffect(() => {
    auth.isFirstUser().then(setIsFirst);
    auth.getCurrentUser().then((u) => {
      if (u) navigate("/monitor", { replace: true });
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
      const user = await auth.login(username, password);
      setWelcomeUser(user.displayName || user.username);
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
      const user = await auth.register(username, password, displayName);
      setWelcomeUser(user.displayName || user.username);
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

    // 在调用 getUserMedia 之前先做安全上下文校验：
    // 移动浏览器在非 HTTPS（且非 localhost）下 mediaDevices 直接为 undefined
    const isSecure =
      typeof window !== "undefined" &&
      (window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    if (!isSecure) {
      setCamErr({
        kind: "insecure",
        raw: "当前页面为 http://，移动浏览器禁止在非安全连接下访问摄像头",
      });
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamErr({
        kind: "unsupported",
        raw: "浏览器不支持 mediaDevices API（常见于微信内置浏览器、QQ 浏览器极速模式等）",
      });
      return;
    }

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
            const user = await auth.loginByFace(blob);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            // 保存人脸 canvas 供表情检测使用
            setWelcomeCanvas(canvasRef.current);
            setWelcomeUser(user.displayName || user.username);
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
    } catch (e) {
      // 区分浏览器抛出的具体错误，方便引导
      const err = e as DOMException & { name?: string; message?: string };
      const name = err?.name || "";
      const msg = err?.message || String(e);
      let kind: CamErrKind = "unknown";
      if (name === "NotAllowedError" || /Permission|denied/i.test(msg)) kind = "denied";
      else if (name === "NotFoundError" || /not found|no.*camera/i.test(msg)) kind = "notfound";
      else if (name === "NotReadableError" || name === "TrackStartError" || /in use|busy/i.test(msg))
        kind = "inuse";
      else if (name === "SecurityError") kind = "insecure";
      setCamErr({ kind, raw: `${name || "Error"}: ${msg}` });
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
      {welcomeUser && (
        <WelcomeOverlay
          displayName={welcomeUser}
          faceCanvas={welcomeCanvas}
          onDone={() => {
            // 登录完成：清掉芽芽的简报冷却，让 /monitor 一到就重新播报
            try { sessionStorage.removeItem("bearpi-agri:yaya-briefed-at"); } catch { /* ignore */ }
            navigate("/monitor", { replace: true });
          }}
        />
      )}
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-green-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl" />
        <Sprout className="absolute top-1/4 left-10 w-32 h-32 text-green-700/20" />
        <Sun className="absolute bottom-1/4 right-10 w-24 h-24 text-green-700/20" />
        <Droplets className="absolute top-1/2 right-1/4 w-20 h-20 text-green-700/15" />
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {camErr && (
        <CameraPermissionDialog
          info={camErr}
          onClose={() => setCamErr(null)}
          onRetry={() => {
            setCamErr(null);
            startFaceLogin();
          }}
        />
      )}

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

/* ====================== 摄像头权限错误弹窗 ====================== */
type CamErrInfo = {
  kind: "insecure" | "denied" | "notfound" | "unsupported" | "inuse" | "unknown";
  raw: string;
};

function CameraPermissionDialog({
  info,
  onClose,
  onRetry,
}: {
  info: CamErrInfo;
  onClose: () => void;
  onRetry: () => void;
}) {
  // 设备 / 浏览器嗅探（仅用于展示对应的指引）
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isAndroid = /Android/i.test(ua);
  const isWeChat = /MicroMessenger/i.test(ua);
  const isQQ = /QQ\//i.test(ua) || /MQQBrowser/i.test(ua);

  const [copied, setCopied] = useState(false);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 降级：使用 execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = currentUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* ignore */
      }
    }
  };

  const titleMap: Record<CamErrInfo["kind"], string> = {
    insecure: "需要 HTTPS 才能使用摄像头",
    denied: "摄像头权限被拒绝",
    notfound: "未检测到摄像头",
    unsupported: "当前浏览器不支持人脸识别",
    inuse: "摄像头被其他程序占用",
    unknown: "无法访问摄像头",
  };

  // 针对当前情境给出操作步骤
  const renderSteps = () => {
    if (info.kind === "insecure" || isWeChat || isQQ) {
      return (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          {(isWeChat || isQQ) && (
            <li className="text-amber-700">
              检测到你正在使用<b>{isWeChat ? "微信" : "QQ"}内置浏览器</b>，无法调用摄像头。
              请点击右上角「···」→「在浏览器打开」。
            </li>
          )}
          <li>
            服务器地址需要使用 <b>HTTPS</b>（或 <code>localhost</code>）。
            当前访问的是 <code className="break-all text-rose-600">{currentUrl}</code>
          </li>
          <li>
            解决办法：让管理员把前端配置成 HTTPS（例如使用 mkcert / nginx 反向代理 / cloudflared），
            或在桌面端使用密码登录。
          </li>
        </ol>
      );
    }
    if (info.kind === "denied") {
      if (isIOS) {
        return (
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>
              打开 iOS <b>「设置」→「Safari 浏览器」→「相机」</b>，把当前网站设为「允许」。
            </li>
            <li>或者：在地址栏左侧的「ぁA」按钮 → 「网站设置」→ 摄像头 → 允许。</li>
            <li>修改后回到此页，点击下方「重试」。</li>
          </ol>
        );
      }
      if (isAndroid) {
        return (
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>
              打开手机<b>「设置」→「应用」→「Chrome / 浏览器」→「权限」→「相机」</b>设为「允许」。
            </li>
            <li>
              或者：在浏览器地址栏左侧点 <b>🔒/ⓘ</b> → 网站设置 → 相机 → 允许。
            </li>
            <li>修改后回到此页，点击下方「重试」。</li>
          </ol>
        );
      }
      return (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            点击浏览器地址栏左侧的 <b>🔒</b> 或 <b>ⓘ</b> 图标 → 「网站设置」→「摄像头」→「允许」。
          </li>
          <li>修改后刷新本页，再次尝试人脸识别。</li>
        </ol>
      );
    }
    if (info.kind === "inuse") {
      return (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>关闭其他正在使用相机的 App（视频通话 / 录像 / 直播等）。</li>
          <li>点击「重试」再次扫描。</li>
        </ol>
      );
    }
    if (info.kind === "notfound") {
      return (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>当前设备未检测到可用相机。</li>
          <li>如果是电脑，请检查 USB 摄像头连接 / 笔记本相机隐私挡板。</li>
        </ol>
      );
    }
    if (info.kind === "unsupported") {
      return (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>请使用<b> Chrome / Edge / Safari </b>等主流浏览器打开本页。</li>
          <li>不支持微信内置浏览器、低版本 UC、QQ 浏览器极速模式等。</li>
        </ol>
      );
    }
    return (
      <p className="text-sm text-gray-700">
        请确认浏览器已授权摄像头权限，并使用 HTTPS / localhost 访问。
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">{titleMap[info.kind]}</h3>
            <p className="text-xs text-gray-500 mt-0.5 break-all">{info.raw}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 指引 */}
        <div className="px-5 py-4 overflow-y-auto">{renderSteps()}</div>

        {/* 复制 URL */}
        {currentUrl && (
          <div className="px-5 pb-2">
            <button
              type="button"
              onClick={copyUrl}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700 hover:bg-gray-100"
            >
              <span className="truncate flex-1 text-left font-mono">{currentUrl}</span>
              {copied ? (
                <span className="text-green-600 flex-shrink-0">已复制</span>
              ) : (
                <Copy className="w-3.5 h-3.5 flex-shrink-0" />
              )}
            </button>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="px-5 py-4 grid grid-cols-2 gap-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 active:scale-95 transition"
          >
            <Settings className="w-4 h-4 inline -mt-0.5 mr-1" />
            去设置
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="py-2.5 rounded-xl bg-emerald-600 text-white text-sm shadow-md hover:bg-emerald-700 active:scale-95 transition"
          >
            <Camera className="w-4 h-4 inline -mt-0.5 mr-1" />
            重试
          </button>
        </div>

        <p className="px-5 pb-4 text-[11px] text-gray-400 text-center">
          浏览器禁止网页直接跳转到系统设置，请按上方步骤手动操作
        </p>
      </div>
    </div>
  );
}

