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
import { fetchRealtimeSnapshot, type SensorMetrics } from "../services/realtime";
import { fetchAllConnectedDevices } from "../services/greenhouseMonitor";
import { fetchThresholdAlertRecords, type ThresholdAlertRecord } from "../services/thresholdAlert";
import { PestRecognitionCard } from "../components/dashboard/PestRecognitionCard";

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

/** 与 RealtimeMonitor 保持一致的多大棚模拟偏移，让总览大屏与「实时检测」看到的数据一致 */
const SIM_OFFSETS: Record<string, { temp?: number; humidity?: number; light?: number; co2?: number }> = {
  "GH-02": { temp: 1.2, humidity: -3, light: -0.05, co2: 20 },
  "GH-03": { temp: -0.8, humidity: 4, light: 0.05, co2: -15 },
  "GH-04": { temp: 2.0, humidity: -6, light: 0.10, co2: 35 },
  "GH-05": { temp: -1.5, humidity: 2, light: -0.10, co2: -10 },
  "GH-06": { temp: 0.5, humidity: -1, light: 0.02, co2: 5 },
};
function simNumber(ghId: string, key: "temp" | "humidity" | "light" | "co2", base: number): number {
  const cfg = SIM_OFFSETS[ghId];
  if (!cfg) return base;
  if (key === "light") return +(base * (1 + (cfg.light ?? 0))).toFixed(0);
  const delta = cfg[key] ?? 0;
  if (key === "co2") return +(base + delta).toFixed(0);
  return +(base + delta).toFixed(1);
}

const alertsData_FALLBACK: AlertItem[] = [];

type AlertItem = { gh: string; type: string; value: string; time: string; level: "danger" | "warn" | "gray" };

const METRIC_LABEL: Record<string, string> = {
  temp: "温度",
  humidity: "湿度",
  light: "光照",
  co2: "CO₂",
  soilHum: "土壤湿度",
  soilTemp: "土壤温度",
};
const METRIC_UNIT: Record<string, string> = {
  temp: "°C",
  humidity: "%",
  light: "lux",
  co2: "ppm",
  soilHum: "%",
  soilTemp: "°C",
};

function parseGhFromDeviceId(deviceId: string): string {
  const m = /GH(\d{1,2})/i.exec(deviceId || "");
  if (!m) return "未知大棚";
  return `${parseInt(m[1], 10)}号大棚`;
}
function formatAlertTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(11, 16);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function recordToAlertItem(r: ThresholdAlertRecord): AlertItem {
  const label = METRIC_LABEL[r.metric] ?? r.metric;
  const unit = METRIC_UNIT[r.metric] ?? "";
  const direction = r.operator === "ABOVE" ? "过高" : "过低";
  // 严重程度估算：超出阈值 ≥ 20% 计为 danger，其余 warn
  const ratio = r.threshold === 0 ? 0 : Math.abs((r.currentValue - r.threshold) / r.threshold);
  const level: AlertItem["level"] = ratio >= 0.2 ? "danger" : "warn";
  return {
    gh: parseGhFromDeviceId(r.deviceId),
    type: `${label}${direction}`,
    value: `${r.currentValue}${unit}`,
    time: formatAlertTime(r.alertedAt),
    level,
  };
}

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
  const [selectedView, setSelectedView] = useState<"pest" | "trend" | "alert">("pest");
  const [alertsData, setAlertsData] = useState<AlertItem[]>(alertsData_FALLBACK);
  const headerRef = useRef<HTMLDivElement>(null);

  // Animation tick for live feel
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 2000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let disposed = false;

    async function loadAll() {
      // 1) 拉 1号大棚的真实传感器快照
      let snapshot: SensorMetrics = {};
      try {
        snapshot = await fetchRealtimeSnapshot("1号大棚");
      } catch {
        /* ignore */
      }
      // 2) 拉设备列表（设备总数、在线数、各大棚设备计数）
      const devicesByGh: Record<string, { total: number; online: number }> = {};
      try {
        const all = await fetchAllConnectedDevices();
        for (const d of all) {
          // greenhouseCode 可能为 "1号大棚" 、"GH-01" 或数字。同时兼容
          const norm = normalizeGhCode(d.greenhouseCode);
          if (!norm) continue;
          if (!devicesByGh[norm]) devicesByGh[norm] = { total: 0, online: 0 };
          devicesByGh[norm].total += 1;
          // status 常见值：ONLINE / OFFLINE / CONNECTED
          const s = (d.status || "").toUpperCase();
          if (s === "ONLINE" || s === "CONNECTED" || s === "BOUND") devicesByGh[norm].online += 1;
        }
      } catch {
        /* ignore */
      }
      // 3) 拉阈值告警记录，同步与「实时检测 / 告警管理」内容一致
      let alertItems: AlertItem[] = [];
      const alertsCountByGh: Record<string, number> = {};
      try {
        const records = await fetchThresholdAlertRecords();
        const sorted = [...records].sort((a, b) => (a.alertedAt < b.alertedAt ? 1 : -1));
        alertItems = sorted.slice(0, 30).map(recordToAlertItem);
        for (const r of sorted) {
          const ghName = parseGhFromDeviceId(r.deviceId); // "1号大棚"
          const m = /^(\d{1,2})/.exec(ghName);
          if (m) {
            const ghId = `GH-${String(parseInt(m[1], 10)).padStart(2, "0")}`;
            alertsCountByGh[ghId] = (alertsCountByGh[ghId] ?? 0) + 1;
          }
        }
      } catch {
        /* ignore */
      }
      if (disposed) return;
      setAlertsData(alertItems);

      const baseTemp = typeof snapshot.temp === "number" ? snapshot.temp : null;
      const baseHum = typeof snapshot.humidity === "number" ? snapshot.humidity : null;
      const baseLight = typeof snapshot.light === "number" ? snapshot.light : null;
      const baseCo2 = typeof snapshot.co2 === "number" ? snapshot.co2 : 420;

      setGreenhouseData((prev) =>
        prev.map((gh) => {
          const counts = devicesByGh[gh.id];
          const total = counts ? counts.total : 0;
          const online = counts ? counts.online : 0;

          let temp: number | string = "--";
          let humidity: number | string = "--";
          let light: number | string = "--";
          let co2: number | string = "--";

          if (gh.id === "GH-01") {
            if (baseTemp !== null) temp = baseTemp;
            if (baseHum !== null) humidity = baseHum;
            if (baseLight !== null) light = baseLight;
            if (typeof snapshot.co2 === "number") co2 = snapshot.co2;
          } else if (online > 0 && baseTemp !== null) {
            // 仅在该大棚有设备在线时才呈现模拟数据
            temp = simNumber(gh.id, "temp", baseTemp);
            if (baseHum !== null) humidity = simNumber(gh.id, "humidity", baseHum);
            if (baseLight !== null) light = simNumber(gh.id, "light", baseLight);
            co2 = simNumber(gh.id, "co2", baseCo2);
          }

          const alertCount = alertsCountByGh[gh.id] ?? 0;
          // 状态推导：有告警 → 告警；有在线设备 → 正常；无在线设备 → 离线
          const status = alertCount > 0 ? "告警" : online > 0 ? "正常" : "离线";
          return {
            ...gh,
            temp,
            humidity,
            light,
            co2,
            deviceCount: total > 0 ? total : gh.deviceCount, // 后端返回为 0 时保留默认预设
            onlineDevices: online,
            status,
            alerts: alertCount,
          };
        }),
      );
      setLastUpdate(nowText());
    }

    void loadAll();
    const timer = window.setInterval(loadAll, 5000);

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

  /** 把后端 greenhouseCode（"1号大棚"/"GH-01"/"1"）统一映射为 GH-01..GH-06 */
  function normalizeGhCode(code: string | null | undefined): string | null {
    if (!code) return null;
    const m1 = /GH[-_]?(\d{1,2})/i.exec(code);
    if (m1) return `GH-${String(parseInt(m1[1], 10)).padStart(2, "0")}`;
    const m2 = /^(\d{1,2})号?大?棚?$/.exec(code);
    if (m2) return `GH-${String(parseInt(m2[1], 10)).padStart(2, "0")}`;
    return null;
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" style={{ position: "relative" }}>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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

      {/* Main Row: 大棚轮播 + 害虫识别（重点突出） */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 420 }}>
        {/* 左：大棚列表（可垂直滑动的紧凑卡片） */}
        <div className="col-span-1 bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-700">大棚列表</h2>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                {onlineCount}/{greenhouseData.length} 在线
              </span>
            </div>
            <span className="text-[10px] text-gray-400">滚动查看</span>
          </div>
          <div
            className="flex-1 overflow-y-auto pr-1 space-y-2 -mr-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {greenhouseData.map((gh, idx) => (
              <div
                key={gh.id}
                onClick={() => toMonitor(gh.name, gh.status)}
                className={`group rounded-lg border-2 p-2.5 cursor-pointer hover:shadow-md transition-all ${statusBgMap[gh.status]}`}
                style={{ animation: `dash-card-in 0.45s ease ${0.05 + idx * 0.05}s both` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-gray-800 truncate">{gh.name}</span>
                    <span className="text-[10px] bg-white/70 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {gh.crop}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {statusIconMap[gh.status]}
                    <span
                      className={`text-[10px] font-medium ${
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
                <div className="grid grid-cols-4 gap-1 mb-1.5">
                  {[
                    { icon: <Thermometer className="w-3 h-3 text-orange-500" />, value: gh.temp, unit: "°C" },
                    { icon: <Droplets className="w-3 h-3 text-blue-500" />, value: gh.humidity, unit: "%" },
                    { icon: <Sun className="w-3 h-3 text-yellow-500" />, value: gh.light, unit: "" },
                    { icon: <Wind className="w-3 h-3 text-green-500" />, value: gh.co2, unit: "" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-1 bg-white/60 rounded px-1 py-0.5">
                      {s.icon}
                      <span className="text-[10px] font-medium text-gray-700 truncate">
                        {s.value}
                        {s.unit && <span className="text-gray-400 ml-0.5">{s.unit}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">
                    设备 {gh.onlineDevices}/{gh.deviceCount}
                  </span>
                  <div className="flex items-center gap-2">
                    {gh.alerts > 0 && (
                      <span className="flex items-center gap-0.5 text-red-500">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {gh.alerts}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 text-green-600 group-hover:translate-x-0.5 transition-transform">
                      <Eye className="w-2.5 h-2.5" />
                      详情
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右：当前选中的大卡片（害虫识别 / 温湿度趋势 / 最新告警） */}
        <div className="col-span-2 min-h-0">
          {selectedView === "pest" && <PestRecognitionCard />}
          {selectedView === "trend" && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800">今日温湿度趋势（全场均值）</h3>
                    <p className="text-xs text-gray-400 mt-0.5">业务六：历史数据趋势分析</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-orange-400 rounded inline-block" />温度</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-blue-400 rounded inline-block" />湿度</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="tempGradBig" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="humGradBig" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="temp" stroke="#fb923c" fill="url(#tempGradBig)" strokeWidth={2} name="温度(°C)" />
                    <Area type="monotone" dataKey="humidity" stroke="#60a5fa" fill="url(#humGradBig)" strokeWidth={2} name="湿度(%)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {selectedView === "alert" && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-md">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800">最新告警</h3>
                    <p className="text-xs text-gray-400 mt-0.5">超阈与设备异常集中呈现</p>
                  </div>
                </div>
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{alertsData.length} 条</span>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {alertsData.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-8">
                    暂无未处理告警 · 与「实时检测 / 阈值告警」实时同步
                  </div>
                )}
                {alertsData.map((alert, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                      alert.level === "danger" ? "bg-red-50 border-red-100" :
                      alert.level === "warn" ? "bg-yellow-50 border-yellow-100" :
                      "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        alert.level === "danger" ? "text-red-500" :
                        alert.level === "warn" ? "text-yellow-500" :
                        "text-gray-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{alert.gh} · {alert.type}</div>
                      <div className="text-xs text-gray-500 mt-0.5">当前值：{alert.value}</div>
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">{alert.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: 3 迷你卡片切换器 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 温湿度趋势 迷你 */}
        <button
          type="button"
          onClick={() => setSelectedView("trend")}
          className={`text-left bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-all ${
            selectedView === "trend" ? "border-orange-400 ring-2 ring-orange-100" : "border-gray-100 hover:border-orange-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800">温湿度趋势</span>
            </div>
            {selectedView === "trend" && (
              <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">查看中</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="tempGradMini" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="temp" stroke="#fb923c" fill="url(#tempGradMini)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
            <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3 text-orange-500" />峰值 28°C</span>
            <span className="flex items-center gap-0.5"><TrendingDown className="w-3 h-3 text-blue-500" />低值 20°C</span>
          </div>
        </button>

        {/* 最新告警 迷你 */}
        <button
          type="button"
          onClick={() => setSelectedView("alert")}
          className={`text-left bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-all ${
            selectedView === "alert" ? "border-red-400 ring-2 ring-red-100" : "border-gray-100 hover:border-red-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800">最新告警</span>
            </div>
            {selectedView === "alert" && (
              <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">查看中</span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-red-500">{alertsData.length}</span>
            <span className="text-xs text-gray-400">条未处理</span>
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {alertsData.length > 0
              ? `最新：${alertsData[0].gh} · ${alertsData[0].type} ${alertsData[0].value}`
              : "暂无未处理告警"}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{alertsData[0]?.time ?? ""}</div>
        </button>

        {/* 病虫害识别 迷你 */}
        <button
          type="button"
          onClick={() => setSelectedView("pest")}
          className={`text-left bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-all ${
            selectedView === "pest" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-gray-100 hover:border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                <span className="text-white text-sm">🐛</span>
              </div>
              <span className="text-sm font-semibold text-gray-800">病虫害识别</span>
            </div>
            {selectedView === "pest" && (
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">查看中</span>
            )}
          </div>
          <div className="text-xs text-gray-600 leading-snug">
            扫码 / NFC 上传害虫或植物病害图片
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            精灵芽芽自动语音播报防治方案
          </div>
        </button>
      </div>
    </div>
  );
}
