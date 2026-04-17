const USERS_KEY = "smartagri_users";
const SESSION_KEY = "smartagri_session";
const LOGIN_ATTEMPTS_KEY = "smartagri_login_attempts";

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 小时
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 分钟

/* ========== 类型 ========== */

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: "admin" | "user";
  faceRegistered: boolean;
  facePersonId?: string;
  createdAt: string;
}

interface Session {
  userId: string;
  loginAt: number;
}

interface LoginAttempts {
  count: number;
  lastAttempt: number;
}

/* ========== 密码哈希 ========== */

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_smartagri_salt_2026");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ========== localStorage 工具 ========== */

function getUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() - session.loginAt > SESSION_TIMEOUT_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function getLoginAttempts(username: string): LoginAttempts {
  try {
    const all = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || "{}");
    return all[username] || { count: 0, lastAttempt: 0 };
  } catch {
    return { count: 0, lastAttempt: 0 };
  }
}

function recordLoginAttempt(username: string, success: boolean) {
  try {
    const all = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || "{}");
    if (success) {
      delete all[username];
    } else {
      const prev = all[username] || { count: 0, lastAttempt: 0 };
      all[username] = { count: prev.count + 1, lastAttempt: Date.now() };
    }
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function isAccountLocked(username: string): boolean {
  const attempts = getLoginAttempts(username);
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    if (Date.now() - attempts.lastAttempt < LOCKOUT_DURATION_MS) {
      return true;
    }
    recordLoginAttempt(username, true); // lockout 过期，重置
    return false;
  }
  return false;
}

/* ========== 公开 API ========== */

/** 是否还没有任何用户（首次使用） */
export function isFirstUser(): boolean {
  return getUsers().length === 0;
}

/** 获取当前登录用户（session 过期返回 null） */
export function getCurrentUser(): User | null {
  const session = getSession();
  if (!session) return null;
  return getUsers().find((u) => u.id === session.userId) || null;
}

/** 当前用户是否管理员 */
export function isAdmin(): boolean {
  return getCurrentUser()?.role === "admin";
}

/** 获取所有用户（仅管理员使用） */
export function getAllUsers(): User[] {
  return getUsers();
}

/** 首次注册（第一个用户自动成为管理员） */
export async function register(
  username: string,
  password: string,
  displayName: string,
): Promise<User> {
  if (username.length < 2) throw new Error("用户名至少2个字符");
  if (password.length < 6) throw new Error("密码至少6个字符");
  if (!displayName.trim()) throw new Error("请输入显示名称");

  const users = getUsers();
  if (users.find((u) => u.username === username)) {
    throw new Error("用户名已存在");
  }

  const isFirst = users.length === 0;
  const user: User = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await hashPassword(password),
    displayName: displayName.trim(),
    role: isFirst ? "admin" : "user",
    faceRegistered: false,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);

  // 自动登录
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ userId: user.id, loginAt: Date.now() }),
  );
  return user;
}

/** 密码登录 */
export async function login(username: string, password: string): Promise<User> {
  if (isAccountLocked(username)) {
    throw new Error("账户已锁定，请5分钟后再试");
  }

  const users = getUsers();
  const user = users.find((u) => u.username === username);
  if (!user) {
    recordLoginAttempt(username, false);
    throw new Error("用户名或密码错误");
  }

  const hash = await hashPassword(password);
  if (user.passwordHash !== hash) {
    recordLoginAttempt(username, false);
    const attempts = getLoginAttempts(username);
    const remaining = MAX_LOGIN_ATTEMPTS - attempts.count;
    if (remaining <= 2 && remaining > 0) {
      throw new Error(`密码错误，还剩 ${remaining} 次尝试机会`);
    }
    throw new Error("用户名或密码错误");
  }

  recordLoginAttempt(username, true);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ userId: user.id, loginAt: Date.now() }),
  );
  return user;
}

/** 人脸识别登录（通过 facePersonId 匹配用户） */
export function loginByFace(facePersonId: string): User {
  const users = getUsers();
  const user = users.find((u) => u.facePersonId === facePersonId);
  if (!user) throw new Error("未找到匹配的用户");
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ userId: user.id, loginAt: Date.now() }),
  );
  return user;
}

/** 管理员添加用户（含人脸注册） */
export async function registerUserWithFace(
  username: string,
  password: string,
  displayName: string,
  facePersonId: string,
): Promise<User> {
  const cur = getCurrentUser();
  if (!cur || cur.role !== "admin") throw new Error("仅管理员可添加用户");
  if (username.length < 2) throw new Error("用户名至少2个字符");
  if (password.length < 6) throw new Error("密码至少6个字符");

  const users = getUsers();
  if (users.find((u) => u.username === username)) throw new Error("用户名已存在");

  const user: User = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await hashPassword(password),
    displayName: displayName.trim(),
    role: "user",
    faceRegistered: true,
    facePersonId,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

/** 更新用户人脸关联 */
export function updateUserFace(userId: string, facePersonId: string) {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error("用户不存在");
  user.faceRegistered = true;
  user.facePersonId = facePersonId;
  saveUsers(users);
}

/** 管理员删除用户 */
export function deleteUser(userId: string) {
  const cur = getCurrentUser();
  if (!cur || cur.role !== "admin") throw new Error("仅管理员可删除用户");
  if (cur.id === userId) throw new Error("不能删除自己的账户");
  const users = getUsers().filter((u) => u.id !== userId);
  saveUsers(users);
}

/** 登出 */
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
