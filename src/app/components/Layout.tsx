import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Activity,
  BellRing,
  Sliders,
  Zap,
  BarChart2,
  Cpu,
  Bot,
  Leaf,
  ChevronRight,
  Users,
  LogOut,
  ClipboardList,
  Menu,
  X,
  Bug,
} from "lucide-react";
import { getCurrentUser, logout, type User } from "../services/auth";
import { YayaFloatingAssistant } from "./YayaFloatingAssistant";

const baseNavItems = [
  { to: "/", icon: LayoutDashboard, label: "总览大屏", desc: "多大棚统一监控" },
  { to: "/monitor", icon: Activity, label: "实时监测", desc: "全指标实时环境" },
  { to: "/alerts", icon: BellRing, label: "阈值告警", desc: "温湿度预警审计" },
  { to: "/control", icon: Sliders, label: "设备控制", desc: "手动/定时控制" },
  { to: "/automation", icon: Zap, label: "联动规则", desc: "复合条件自动化" },
  { to: "/history", icon: BarChart2, label: "历史分析", desc: "数据趋势图表" },
  { to: "/devices", icon: Cpu, label: "设备管理", desc: "绑定/解绑设备" },
  { to: "/ai", icon: Bot, label: "农事问答", desc: "AI智能助手" },
];

const adminNavItem = { to: "/users", icon: Users, label: "用户管理", desc: "用户与人脸管理" };
const logsNavItem = { to: "/logs", icon: ClipboardList, label: "登录日志", desc: "用户登录记录" };
// 病虫害识别主要为手机移动端扫码/拍照场景,放在侧边栏最末尾
const insectNavItem = { to: "/insect", icon: Bug, label: "病虫害识别", desc: "害虫+病害 拍照识别" };

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  // 路由切换时关闭抽屉
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // 抽屉打开时禁止背景滚动
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const adminUser = user?.role === "admin";
  const navItems = adminUser
    ? [...baseNavItems, adminNavItem, logsNavItem, insectNavItem]
    : [...baseNavItems, insectNavItem];

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const currentNav =
    navItems.find((it) =>
      it.to === "/" ? location.pathname === "/" : location.pathname.startsWith(it.to),
    ) || baseNavItems[0];
  const CurrentIcon = currentNav.icon;

  // 侧边栏内容（PC 与抽屉共用）
  const sidebar = (
    <>
      <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-green-700">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-green-400 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
            <Leaf className="w-5 h-5 text-green-900" />
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold leading-tight truncate">
              智慧农业大棚
            </div>
            <div className="text-green-300 text-xs">管理系统 v2.0</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden p-1.5 text-green-300 hover:text-white rounded-lg"
          aria-label="关闭菜单"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-green-400/20 border border-green-400/40"
                  : "hover:bg-green-700/50 border border-transparent"
              }`}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? "text-green-300" : "text-green-400 group-hover:text-green-300"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium truncate ${
                    isActive ? "text-white" : "text-green-100 group-hover:text-white"
                  }`}
                >
                  {item.label}
                </div>
                <div className="text-xs text-green-400 truncate">{item.desc}</div>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 text-green-300 flex-shrink-0" />}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-green-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.displayName?.charAt(0) || "?"}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-medium truncate">
                {user?.displayName || "未知"}
              </div>
              <div className="text-green-400 text-xs truncate">
                {user?.role === "admin" ? "管理员" : "普通用户"}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-green-400 hover:text-white hover:bg-green-700 rounded-lg transition-colors flex-shrink-0"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 桌面端固定侧边栏 */}
      <aside className="hidden md:flex w-64 bg-gradient-to-b from-green-900 to-green-800 flex-col shadow-xl flex-shrink-0">
        {sidebar}
      </aside>

      {/* 移动端抽屉遮罩 */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="关闭菜单"
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 移动端抽屉 */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-gradient-to-b from-green-900 to-green-800 flex flex-col shadow-2xl z-50 transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 移动端顶部栏 */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CurrentIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {currentNav.label}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {currentNav.desc}
              </div>
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.displayName?.charAt(0) || "?"}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <YayaFloatingAssistant />
    </div>
  );
}

