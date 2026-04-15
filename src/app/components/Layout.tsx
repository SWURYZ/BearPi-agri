import { Outlet, NavLink, useLocation } from "react-router";
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
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "总览大屏", desc: "多大棚统一监控" },
  { to: "/monitor", icon: Activity, label: "实时监测", desc: "全指标实时环境" },
  { to: "/alerts", icon: BellRing, label: "阈值告警", desc: "温湿度预警审计" },
  { to: "/control", icon: Sliders, label: "设备控制", desc: "手动/定时控制" },
  { to: "/automation", icon: Zap, label: "联动规则", desc: "复合条件自动化" },
  { to: "/history", icon: BarChart2, label: "历史分析", desc: "数据趋势图表" },
  { to: "/devices", icon: Cpu, label: "设备管理", desc: "绑定/解绑设备" },
  { to: "/ai", icon: Bot, label: "农事问答", desc: "AI智能助手" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-green-900 to-green-800 flex flex-col shadow-xl flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-green-700">
          <div className="w-9 h-9 bg-green-400 rounded-xl flex items-center justify-center shadow-md">
            <Leaf className="w-5 h-5 text-green-900" />
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-tight">智慧农业大棚</div>
            <div className="text-green-300 text-xs">管理系统 v2.0</div>
          </div>
        </div>

        {/* Nav Items */}
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

        {/* Footer */}
        <div className="px-4 py-4 border-t border-green-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
              管
            </div>
            <div>
              <div className="text-white text-xs font-medium">管理员</div>
              <div className="text-green-400 text-xs">admin@farm.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
