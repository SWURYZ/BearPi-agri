const API_BASE = "/api/auth";
const TOKEN_KEY = "smartagri_token";

/* ========== 类型 ========== */

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "user";
  registeredBy?: string;
  faceRegistered: boolean;
  facePersonId?: string;
  createdAt: string;
}

export interface LoginLog {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  loginType: "password" | "face" | "register";
  clientIp?: string;
  loginTime: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

/* ========== Token 管理 ========== */

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(init?.headers as Record<string, string> || {}),
  };
  return fetch(url, { ...init, headers });
}

async function jsonPost(url: string, body: object): Promise<Response> {
  return authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.message || fallback;
  } catch {
    return fallback;
  }
}

/* ========== 内存缓存 ========== */

let cachedUser: User | null = null;

/* ========== 公开 API ========== */

/** 是否还没有任何用户（首次使用） */
export async function isFirstUser(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/first-user`);
    const data = await res.json();
    return data.firstUser;
  } catch {
    return false;
  }
}

/** 获取当前登录用户（无 token 或过期返回 null） */
export async function getCurrentUser(): Promise<User | null> {
  const token = getToken();
  if (!token) { cachedUser = null; return null; }
  try {
    const res = await authFetch(`${API_BASE}/me`);
    if (!res.ok) { clearToken(); cachedUser = null; return null; }
    cachedUser = await res.json();
    return cachedUser;
  } catch {
    cachedUser = null;
    return null;
  }
}

/** 同步获取缓存的当前用户（路由守卫等非 async 场景） */
export function getCachedUser(): User | null {
  return cachedUser;
}

/** 当前用户是否管理员（读缓存） */
export function isAdmin(): boolean {
  return cachedUser?.role === "admin";
}

/** 是否持有 token（快速判断，不验证有效性） */
export function hasToken(): boolean {
  return !!getToken();
}

/** 获取所有用户（所有已登录用户可查看） */
export async function getAllUsers(): Promise<User[]> {
  const res = await authFetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error(await parseError(res, "获取用户列表失败"));
  return res.json();
}

/** 获取登录日志 */
export async function getLoginLogs(): Promise<LoginLog[]> {
  const res = await authFetch(`${API_BASE}/logs`);
  if (!res.ok) throw new Error(await parseError(res, "获取日志失败"));
  return res.json();
}

/** 首次注册（第一个用户自动成为管理员） */
export async function register(
  username: string,
  password: string,
  displayName: string,
): Promise<User> {
  const res = await jsonPost(`${API_BASE}/register`, { username, password, displayName });
  if (!res.ok) throw new Error(await parseError(res, "注册失败"));
  const data: AuthResponse = await res.json();
  setToken(data.token);
  cachedUser = data.user;
  return data.user;
}

/** 密码登录 */
export async function login(username: string, password: string): Promise<User> {
  const res = await jsonPost(`${API_BASE}/login`, { username, password });
  if (!res.ok) throw new Error(await parseError(res, "登录失败"));
  const data: AuthResponse = await res.json();
  setToken(data.token);
  cachedUser = data.user;
  return data.user;
}

/** 人脸识别登录（发送图片到后端，后端完成识别+匹配） */
export async function loginByFace(imageBlob: Blob): Promise<User> {
  const form = new FormData();
  form.append("image", imageBlob, "face.jpg");
  const res = await fetch(`${API_BASE}/face-login`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await parseError(res, "人脸登录失败"));
  const data: AuthResponse = await res.json();
  setToken(data.token);
  cachedUser = data.user;
  return data.user;
}

/** 管理员添加用户（含可选人脸照片） */
export async function registerUserWithFace(
  username: string,
  password: string,
  displayName: string,
  imageBlob?: Blob,
): Promise<User> {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("displayName", displayName);
  if (imageBlob) form.append("image", imageBlob, "face.jpg");
  const res = await authFetch(`${API_BASE}/users`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await parseError(res, "添加用户失败"));
  return res.json();
}

/** 为用户注册/更新人脸 */
export async function updateUserFace(userId: number, imageBlob: Blob): Promise<User> {
  const form = new FormData();
  form.append("image", imageBlob, "face.jpg");
  const res = await authFetch(`${API_BASE}/users/${userId}/face`, { method: "PUT", body: form });
  if (!res.ok) throw new Error(await parseError(res, "人脸注册失败"));
  return res.json();
}

/** 管理员修改用户角色 */
export async function updateUserRole(userId: number, role: "admin" | "user"): Promise<User> {
  const res = await authFetch(`${API_BASE}/users/${userId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(await parseError(res, "修改角色失败"));
  return res.json();
}

/** 管理员删除用户 */
export async function deleteUser(userId: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/users/${userId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseError(res, "删除失败"));
}

/** 登出 */
export async function logout(): Promise<void> {
  try {
    await authFetch(`${API_BASE}/logout`, { method: "POST" });
  } catch { /* ignore */ }
  clearToken();
  cachedUser = null;
}

/** 系统初始化：清除所有用户（仅开发调试） */
export async function resetSystem(): Promise<void> {
  const res = await fetch(`${API_BASE}/reset`, { method: "POST" });
  if (!res.ok) throw new Error(await parseError(res, "初始化失败"));
  clearToken();
  cachedUser = null;
}
