import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Thermometer,
  Droplets,
  Sun,
  Wind,
  AlertTriangle,
  CheckCircle,
  WifiOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Eye,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { SimpleModal } from "../components/ui/SimpleModal";
import { fetchRealtimeSnapshot } from "../services/realtime";

const DASH_KEYFRAMES = `
@keyframes dash-fade-up { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes dash-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.55)} 50%{box-shadow:0 0 0 8px rgba(74,222,128,0)} }
@keyframes dash-scan    { from{transform:translateY(-100%)} to{transform:translateY(400px)} }
@keyframes dash-count   { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
@keyframes dash-dot     { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.7);opacity:0.4} }
@keyframes dash-border  { 0%,100%{border-color:rgba(74,222,128,0.25)} 50%{border-color:rgba(74,222,128,0.7)} }
@keyframes dash-shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
@keyframes dash-card-in { from{opacity:0;transform:scale(0.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
`;

const greenhouses = [
  {
    id: "GH-01",
    name: "1号大棚",
    crop: "番茄",
    status: "正常",
    statusColor: "green",
    temp: "--",
    humidity: "--",
    light: "--",
    co2: "--",
    deviceCount: 12,
    onlineDevices: 12,
    alerts: 0,
  },
  {
    id: "GH-02",
    name: "2号大棚",
    crop: "黄瓜",
    status: "离线",
    statusColor: "gray",
    temp: "--",
    humidity: "--",
    light: "--",
    co2: "--",
    deviceCount: 10,
    onlineDevices: 0,
    alerts: 0,
  },
  {
    id: "GH-03",
    name: "3号大棚",
    crop: "草莓",
    status: "离线",
    statusColor: "gray",
    temp: "--",
    humidity: "--",
    light: "--",
    co2: "--",
    deviceCount: 8,
    onlineDevices: 0,
    alerts: 0,
  },
  {
    id: "GH-04",
    name: "4号大棚",
    crop: "辣椒",
    status: "离线",
    statusColor: "gray",
    temp: "--",
    humidity: "--",
    light: "--",
    co2: "--",
    deviceCount: 6,
    onlineDevices: 0,
    alerts: 1,
  },
  {
    id: "GH-05",
    name: "5号大棚",
    crop: "生菜",
    status: "离线",
    statusColor: "gray",
    temp: "--",
    humidity: "--",
    light: "--",
    co2: "--",
    deviceCount: 9,
    onlineDevices: 0,
    alerts: 0,
  },
  {
    id: "GH-06",
    name: "6号大棚",
    crop: "茄子",
    status: "离线",
    statusColor: "gray",
    temp: "--",
    humidity: "--",
    light: "--",
    co2: "--",
    deviceCount: 11,
    onlineDevices: 0,
    alerts: 0,
  },
];

const trendData = [
  { time: "00:00", temp: 22, humidity: 65 },
  { time: "04:00", temp: 20, humidity: 68 },
  { time: "08:00", temp: 24, humidity: 70 },
  { time: "12:00", temp: 28, humidity: 63 },
  { time: "16:00", temp: 26, humidity: 60 },
  { time: "20:00", temp: 24, humidity: 64 },
  { time: "23:59", temp: 22, humidity: 66 },
];

const statusIconMap: Record<string, React.ReactNode> = {
  正常: <CheckCircle className="w-4 h-4 text-green-500" />,
  告警: <AlertTriangle className="w-4 h-4 text-red-500" />,
  离线: <WifiOff className="w-4 h-4 text-gray-400" />,
};

const statusBgMap: Record<string, string> = {
  正常: "bg-green-50 border-green-200",
  告警: "bg-red-50 border-red-200",
  离线: "bg-gray-50 border-gray-200",
};

export function Dashboard() {
  const navigate = useNavigate();
  const [greenhouseData, setGreenhouseData] = useState(greenhouses);
  const [lastUpdate, setLastUpdate] = useState("2026-04-14 14:32:05");
  const [refreshNotice, setRefreshNotice] = useState("");
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false);
  const [offlineGhName, setOfflineGhName] = useState("");
  const [tick, setTick] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  // Animation tick for live feel
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 2000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let disposed = false;

    async function loadRealtimeForGh1() {
      try {
        const snapshot = await fetchRealtimeSnapshot("1号大棚");
        if (disposed) {
          return;
        }

        if (Object.keys(snapshot).length === 0) {
          setGreenhouseData((prev) =>
            prev.map((gh) =>
              gh.id === "GH-01"
                ? { ...gh, temp: "--", humidity: "--", light: "--", co2: "--" }
                : gh,
            ),
          );
          return;
        }

        setGreenhouseData((prev) =>
          prev.map((gh) =>
            gh.id === "GH-01"
              ? {
                  ...gh,
                  temp: typeof snapshot.temp === "number" ? snapshot.temp : "--",
                  humidity: typeof snapshot.humidity === "number" ? snapshot.humidity : "--",
                  light: typeof snapshot.light === "number" ? snapshot.light : "--",
                  co2: "--",
                }
              : gh,
          ),
        );
        setLastUpdate(nowText());
      } catch {
        if (!disposed) {
          setGreenhouseData((prev) =>
            prev.map((gh) =>
              gh.id === "GH-01"
                ? { ...gh, temp: "--", humidity: "--", light: "--", co2: "--" }
                : gh,
            ),
          );
        }
      }
    }

    void loadRealtimeForGh1();
    const timer = window.setInterval(loadRealtimeForGh1, 5000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const totalAlerts = greenhouseData.reduce((sum, g) => sum + g.alerts, 0);
  const onlineCount = greenhouseData.filter((g) => g.status !== "离线").length;

  function nowText() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  function handleRefresh() {
    // Only GH-01 is online for now; keep other greenhouses offline static.
    setLastUpdate(nowText());
    setRefreshNotice("刷新成功，已更新最新实时数据");
    window.setTimeout(() => setRefreshNotice(""), 2200);
  }

  function toMonitor(ghName: string, status: string) {
    if (status === "离线") {
      setOfflineGhName(ghName);
      setOfflineDialogOpen(true);
      return;
    }
    navigate(`/monitor?gh=${encodeURIComponent(ghName)}`);
  }

  return (
    <div className="p-6 space-y-6" style={{ position: "relative" }}>
      <style>{DASH_KEYFRAMES}</style>

      <SimpleModal
        open={offlineDialogOpen}
        title="大棚离线"
        description={`${offlineGhName} 当前离线，无法预览实时监测页面。`}
        confirmText="知道了"
        hideCancel
        onConfirm={() => setOfflineDialogOpen(false)}
        onCancel={() => setOfflineDialogOpen(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between" ref={headerRef} style={{ animation: "dash-fade-up 0.5s ease both" }}>
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            多大棚统一监控总览
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)", animation: `dash-border 2.5s ease-in-out ${tick % 2 === 0 ? "0s" : "0.2s"} infinite` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "dash-dot 1.4s ease-in-out infinite" }} />
              LIVE
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">最后更新：{lastUpdate}</div>
          {refreshNotice && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
              {refreshNotice}
            </div>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "大棚总数", value: greenhouseData.length, unit: "个", color: "blue", icon: "🏗️" },
          { label: "在线大棚", value: onlineCount, unit: "个", color: "green", icon: "✅" },
          { label: "告警数量", value: totalAlerts, unit: "条", color: "red", icon: "🔔" },
          { label: "设备总数", value: greenhouseData.reduce((s, g) => s + g.deviceCount, 0), unit: "台", color: "purple", icon: "📡" },
        ].map((card, i) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
            style={{ animation: `dash-card-in 0.45s ease ${i * 0.08}s both`, overflow: "hidden", position: "relative" }}>
            {/* Shimmer line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${card.color === "green" ? "#4ade80" : card.color === "blue" ? "#60a5fa" : card.color === "red" ? "#f87171" : "#c084fc"}, transparent)`, backgroundSize: "200% 100%", animation: "dash-shimmer 2.5s linear infinite" }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{card.label}</span>
              <span className="text-xl">{card.icon}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${card.color === "red" && card.value > 0 ? "text-red-500" : "text-gray-800"}`}
                style={{ animation: "dash-count 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>
                {card.value}
              </span>
              <span className="text-sm text-gray-400">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Greenhouse Cards Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">大棚列表</h2>
        <div className="grid grid-cols-3 gap-4">
          {greenhouseData.map((gh, idx) => (
          <div
              key={gh.id}
              className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${statusBgMap[gh.status]}`}
              style={{
                animation: `dash-card-in 0.5s ease ${0.1 + idx * 0.07}s both`,
                ...(gh.status === "正常" ? { animation: `dash-card-in 0.5s ease ${0.1 + idx * 0.07}s both, dash-border 3s ease-in-out infinite` } : {}),
              }}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{gh.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{gh.crop}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{gh.id}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {statusIconMap[gh.status]}
                  <span
                    className={`text-xs font-medium ${
                      gh.status === "正常"
                        ? "text-green-600"
                        : gh.status === "告警"
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    {gh.status}
                  </span>
                </div>
              </div>

              {/* Sensor Data */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { icon: <Thermometer className="w-3.5 h-3.5 text-orange-500" />, label: "温度", value: gh.temp, unit: "°C" },
                  { icon: <Droplets className="w-3.5 h-3.5 text-blue-500" />, label: "湿度", value: gh.humidity, unit: "%" },
                  { icon: <Sun className="w-3.5 h-3.5 text-yellow-500" />, label: "光照", value: gh.light, unit: "lux" },
                  { icon: <Wind className="w-3.5 h-3.5 text-green-500" />, label: "CO₂", value: gh.co2, unit: "ppm" },
                ].map((sensor) => (
                  <div key={sensor.label} className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2 py-1.5">
                    {sensor.icon}
                    <div>
                      <div className="text-xs text-gray-400">{sensor.label}</div>
                      <div className="text-sm font-semibold text-gray-700">
                        {sensor.value}
                        <span className="text-xs font-normal text-gray-400 ml-0.5">{sensor.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  设备: {gh.onlineDevices}/{gh.deviceCount} 在线
                </div>
                {gh.alerts > 0 && (
                  <div className="flex items-center gap-1 text-xs text-red-500">
                    <AlertTriangle className="w-3 h-3" />
                    {gh.alerts} 条告警
                  </div>
                )}
                <button
                  onClick={() => toMonitor(gh.name, gh.status)}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                >
                  <Eye className="w-3 h-3" />
                  详情
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Row: Trend Chart + Alert List */}
      <div className="grid grid-cols-3 gap-4">
        {/* Trend Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">今日温湿度趋势（全场均值）</h3>
              <p className="text-xs text-gray-400 mt-0.5">业务六：历史数据趋势分析</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-orange-400 rounded inline-block" />温度</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-blue-400 rounded inline-block" />湿度</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="temp" stroke="#fb923c" fill="url(#tempGrad)" strokeWidth={2} name="温度(°C)" />
              <Area type="monotone" dataKey="humidity" stroke="#60a5fa" fill="url(#humGrad)" strokeWidth={2} name="湿度(%)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">最新告警</h3>
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{totalAlerts} 条</span>
          </div>
          <div className="space-y-2">
            {[
              { gh: "2号大棚", type: "温度过高", value: "32.1°C", time: "14:28", level: "danger" },
              { gh: "2号大棚", type: "湿度过高", value: "85%", time: "14:25", level: "danger" },
              { gh: "6号大棚", type: "光照过强", value: "11200lux", time: "13:50", level: "warn" },
              { gh: "4号大棚", type: "设备离线", value: "全部离线", time: "12:00", level: "gray" },
            ].map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-2 rounded-lg border ${
                  alert.level === "danger" ? "bg-red-50 border-red-100" :
                  alert.level === "warn" ? "bg-yellow-50 border-yellow-100" :
                  "bg-gray-50 border-gray-100"
                }`}
              >
                <AlertTriangle
                  className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                    alert.level === "danger" ? "text-red-500" :
                    alert.level === "warn" ? "text-yellow-500" :
                    "text-gray-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 truncate">{alert.gh} · {alert.type}</div>
                  <div className="text-xs text-gray-500">{alert.value}</div>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">{alert.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
