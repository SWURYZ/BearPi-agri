import { useState, useRef, useCallback, useEffect } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Camera,
  ScanFace,
  Shield,
  ShieldCheck,
  ShieldOff,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import * as auth from "../services/auth";
import { listFaceRecords, deleteFaceRecord, type FaceRecordInfo } from "../services/faceRecognition";
import { SimpleModal } from "../components/ui/SimpleModal";

type AddStep = "form" | "camera" | "uploading" | "done";

export function UserManagement() {
  const [users, setUsers] = useState<auth.User[]>([]);
  const [faceRecords, setFaceRecords] = useState<FaceRecordInfo[]>([]);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<auth.User | null>(null);
  const isAdminUser = currentUser?.role === "admin";

  /* ---- 添加用户状态 ---- */
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<AddStep>("form");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [addError, setAddError] = useState("");

  /* ---- 摄像头 ---- */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ---- 为已有用户注册人脸 ---- */
  const [faceTarget, setFaceTarget] = useState<auth.User | null>(null);
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceStepDone, setFaceStepDone] = useState(false);
  const [faceAddError, setFaceAddError] = useState("");

  /* ---- 删除确认 ---- */
  const [deleteTarget, setDeleteTarget] = useState<auth.User | null>(null);
  const [deleteFaceTarget, setDeleteFaceTarget] = useState<FaceRecordInfo | null>(null);

  /* ---- 角色变更确认 ---- */
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: auth.User; newRole: "admin" | "user" } | null>(null);

  /* ---- 加载数据 ---- */
  const refreshUsers = useCallback(async () => {
    try {
      setUsers(await auth.getAllUsers());
    } catch { setUsers([]); }
  }, []);

  const refreshFaces = useCallback(async () => {
    try {
      setFaceError(null);
      const list = await listFaceRecords();
      setFaceRecords(list);
    } catch {
      setFaceError("无法连接人脸识别服务");
      setFaceRecords([]);
    }
  }, []);

  useEffect(() => {
    auth.getCurrentUser().then(setCurrentUser);
    refreshUsers();
    refreshFaces();
  }, [refreshUsers, refreshFaces]);

  /* ---- 清理 ---- */
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      faceStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ---- 打开摄像头 ---- */
  const openCamera = useCallback(async () => {
    setAddError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setAddStep("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setAddError("无法访问摄像头");
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* ---- 拍照并注册 ---- */
  const captureAndRegister = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
    );
    if (!blob) {
      setAddError("拍照失败");
      return;
    }

    setAddStep("uploading");
    closeCamera();

    try {
      // 直接通过后端创建用户（后端同时注册人脸）
      await auth.registerUserWithFace(
        newUsername.trim(),
        newPassword,
        newDisplayName.trim(),
        blob,
      );

      setAddStep("done");
      refreshUsers();
      refreshFaces();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "操作失败");
      setAddStep("form");
    }
  }, [newUsername, newPassword, newDisplayName, closeCamera, refreshUsers, refreshFaces]);

  /* ---- 为已有用户打开人脸注册弹窗 ---- */
  const openFaceRegister = useCallback(async (user: auth.User) => {
    setFaceTarget(user);
    setFaceAddError("");
    setFaceStepDone(false);
    setFaceUploading(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      faceStreamRef.current = stream;
      requestAnimationFrame(() => {
        if (faceVideoRef.current) faceVideoRef.current.srcObject = stream;
      });
    } catch {
      setFaceAddError("无法访问摄像头");
    }
  }, []);

  const closeFaceRegister = useCallback(() => {
    faceStreamRef.current?.getTracks().forEach((t) => t.stop());
    faceStreamRef.current = null;
    setFaceTarget(null);
    setFaceAddError("");
    setFaceStepDone(false);
    setFaceUploading(false);
  }, []);

  const captureFaceForUser = useCallback(async () => {
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    if (!video || !canvas || !faceTarget) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
    );
    if (!blob) { setFaceAddError("拍照失败"); return; }

    setFaceUploading(true);
    faceStreamRef.current?.getTracks().forEach((t) => t.stop());
    faceStreamRef.current = null;

    try {
      await auth.updateUserFace(faceTarget.id, blob);
      setFaceStepDone(true);
      refreshUsers();
      refreshFaces();
    } catch (err) {
      setFaceAddError(err instanceof Error ? err.message : "人脸注册失败");
    } finally {
      setFaceUploading(false);
    }
  }, [faceTarget, refreshUsers, refreshFaces]);

  /* ---- 取消添加 ---- */
  const cancelAdd = useCallback(() => {
    closeCamera();
    setShowAdd(false);
    setAddStep("form");
    setNewUsername("");
    setNewPassword("");
    setNewDisplayName("");
    setAddError("");
  }, [closeCamera]);

  /* ---- 变更角色 ---- */
  const handleRoleChange = useCallback(
    async (user: auth.User, newRole: "admin" | "user") => {
      try {
        await auth.updateUserRole(user.id, newRole);
        refreshUsers();
      } catch {
        /* ignore */
      }
      setRoleChangeTarget(null);
    },
    [refreshUsers],
  );

  /* ---- 删除用户 ---- */
  const handleDeleteUser = useCallback(
    async (user: auth.User) => {
      try {
        await auth.deleteUser(user.id);
        refreshUsers();
      } catch {
        /* ignore */
      }
      setDeleteTarget(null);
    },
    [refreshUsers],
  );

  /* ---- 删除人脸 ---- */
  const handleDeleteFace = useCallback(
    async (record: FaceRecordInfo) => {
      try {
        await deleteFaceRecord(record.personId);
        refreshFaces();
      } catch {
        /* ignore */
      }
      setDeleteFaceTarget(null);
    },
    [refreshFaces],
  );

  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-500">请先登录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 to-green-50/30 p-6 overflow-y-auto">
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={faceCanvasRef} className="hidden" />

      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-600" />
            用户管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理系统用户及人脸注册信息，任意农户可为他人注册</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-md shadow-green-600/20"
        >
          <UserPlus className="w-4 h-4" />
          添加用户
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-800">{users.length}</div>
          <div className="text-xs text-gray-500 mt-1">总用户数</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {users.filter((u) => u.role === "admin").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">管理员</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-bold text-violet-600">
            {users.filter((u) => u.faceRegistered).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">已注册人脸</div>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">系统用户</h2>
        </div>
        {users.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">暂无用户</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      u.role === "admin" ? "bg-green-500" : "bg-blue-500"
                    }`}
                  >
                    {u.displayName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                      {u.displayName}
                      {u.role === "admin" && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                          管理员
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-3">
                      <span>@{u.username}</span>
                      {u.registeredBy && (
                        <span className="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                          负责人: {u.registeredBy}
                        </span>
                      )}
                      <span>
                        {u.faceRegistered ? (
                          <span className="text-violet-500">
                            <ScanFace className="w-3 h-3 inline -mt-0.5" /> 已注册人脸
                          </span>
                        ) : (
                          "未注册人脸"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!u.faceRegistered && (
                    <button
                      onClick={() => openFaceRegister(u)}
                      className="p-2 text-violet-400 hover:text-violet-600 transition-colors"
                      title="注册人脸"
                    >
                      <ScanFace className="w-4 h-4" />
                    </button>
                  )}
                  {u.id !== currentUser?.id && isAdminUser && (
                    <button
                      onClick={() => setRoleChangeTarget({ user: u, newRole: u.role === "admin" ? "user" : "admin" })}
                      className={`p-2 transition-colors ${
                        u.role === "admin"
                          ? "text-green-400 hover:text-orange-500"
                          : "text-gray-300 hover:text-green-600"
                      }`}
                      title={u.role === "admin" ? "撤销管理员" : "设为管理员"}
                    >
                      {u.role === "admin" ? (
                        <ShieldOff className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {u.id !== currentUser?.id && isAdminUser && (
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="删除用户"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 人脸记录管理 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ScanFace className="w-4 h-4 text-violet-500" />
            人脸记录
          </h2>
          <button
            onClick={refreshFaces}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            刷新
          </button>
        </div>
        {faceError ? (
          <div className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{faceError}</p>
            <p className="text-xs text-gray-400 mt-1">请确认人脸识别服务已启动</p>
          </div>
        ) : faceRecords.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">暂无已注册人脸</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {faceRecords.map((r) => (
              <div key={r.personId} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                <div>
                  <p className="text-sm font-medium text-gray-700">{r.personName}</p>
                  <p className="text-xs text-gray-400">ID: {r.personId}</p>
                </div>
                <button
                  onClick={() => setDeleteFaceTarget(r)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  title="删除人脸"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== 添加用户弹窗 ====== */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* 标题 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">添加用户</h3>
              <button onClick={cancelAdd} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {/* Step 1: 表单 */}
              {addStep === "form" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                    新用户需要拍摄人脸照片注册后才能使用系统。
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">显示名称</label>
                    <input
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="真实姓名"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">用户名</label>
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="至少2个字符"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">初始密码</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="至少6个字符"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-400 transition-all"
                    />
                  </div>
                  {addError && (
                    <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {addError}
                    </p>
                  )}
                  <button
                    onClick={openCamera}
                    disabled={!newDisplayName.trim() || !newUsername.trim() || newPassword.length < 6}
                    className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    下一步：拍摄人脸
                  </button>
                </div>
              )}

              {/* Step 2: 拍照 */}
              {addStep === "camera" && (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-36 h-48 border-2 border-dashed border-white/50 rounded-[40%]" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    请让 <strong>{newDisplayName}</strong> 面朝镜头，点击下方按钮拍照注册
                  </p>
                  {addError && (
                    <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {addError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        closeCamera();
                        setAddStep("form");
                      }}
                      className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      返回
                    </button>
                    <button
                      onClick={captureAndRegister}
                      className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      拍照注册
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: 上传中 */}
              {addStep === "uploading" && (
                <div className="py-8 text-center">
                  <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-600">正在注册人脸并创建用户...</p>
                </div>
              )}

              {/* Step 4: 完成 */}
              {addStep === "done" && (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">用户添加成功！</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {newDisplayName} 已可使用密码或人脸识别登录系统
                  </p>
                  <button
                    onClick={cancelAdd}
                    className="mt-4 px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-all"
                  >
                    完成
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== 为已有用户注册人脸弹窗 ====== */}
      {faceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">
                为「{faceTarget.displayName}」注册人脸
              </h3>
              <button onClick={closeFaceRegister} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {faceStepDone ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">人脸注册成功！</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {faceTarget.displayName} 现在可以使用人脸识别登录
                  </p>
                  <button
                    onClick={closeFaceRegister}
                    className="mt-4 px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-all"
                  >
                    完成
                  </button>
                </div>
              ) : faceUploading ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-600">正在注册人脸...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      ref={faceVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-36 h-48 border-2 border-dashed border-white/50 rounded-[40%]" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    请让 <strong>{faceTarget.displayName}</strong> 面朝镜头，点击下方按钮拍照
                  </p>
                  {faceAddError && (
                    <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {faceAddError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={closeFaceRegister}
                      className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={captureFaceForUser}
                      className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      拍照注册
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 删除用户确认 */}
      <SimpleModal
        open={!!deleteTarget}
        title="确认删除用户"
        description={`确定要删除用户「${deleteTarget?.displayName}」(@${deleteTarget?.username}) 吗？此操作不可恢复。`}
        confirmText="删除"
        onConfirm={() => deleteTarget && handleDeleteUser(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 删除人脸确认 */}
      <SimpleModal
        open={!!deleteFaceTarget}
        title="确认删除人脸"
        description={`确定要删除「${deleteFaceTarget?.personName}」的人脸记录吗？`}
        confirmText="删除"
        onConfirm={() => deleteFaceTarget && handleDeleteFace(deleteFaceTarget)}
        onCancel={() => setDeleteFaceTarget(null)}
      />

      {/* 角色变更确认 */}
      <SimpleModal
        open={!!roleChangeTarget}
        title={roleChangeTarget?.newRole === "admin" ? "设为管理员" : "撤销管理员"}
        description={
          roleChangeTarget?.newRole === "admin"
            ? `确定将「${roleChangeTarget?.user.displayName}」设为管理员？管理员拥有删除用户等权限。`
            : `确定撤销「${roleChangeTarget?.user.displayName}」的管理员权限？`
        }
        confirmText={roleChangeTarget?.newRole === "admin" ? "设为管理员" : "撤销"}
        onConfirm={() => roleChangeTarget && handleRoleChange(roleChangeTarget.user, roleChangeTarget.newRole)}
        onCancel={() => setRoleChangeTarget(null)}
      />
    </div>
  );
}
