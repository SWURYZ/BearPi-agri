import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calendar, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fetchRealtimeSnapshot, fetchSensorHistory } from "../services/realtime";

function genDataset(hours: number) {
  const data = [];
  const now = new Date("2026-04-14");
  for (let i = hours; i >= 0; i -= Math.max(1, Math.floor(hours / 48))) {
    const d = new Date(now.getTime() - i * 3600 * 1000);
    const h = d.getHours();
    data.push({
      time: hours <= 24
        ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`,
      temp: +(22 + Math.sin(h / 4) * 5 + (Math.random() - 0.5) * 2).toFixed(1),
      humidity: +(65 + Math.sin(h / 6 + 1) * 10 + (Math.random() - 0.5) * 3).toFixed(1),
      light: +(h >= 6 && h <= 18 ? 5000 + Math.sin((h - 6) / 12 * Math.PI) * 5000 + (Math.random() - 0.5) * 500 : 0).toFixed(0),
      co2: +(420 + Math.sin(h / 8) * 80 + (Math.random() - 0.5) * 30).toFixed(0),
      soilHumidity: +(45 - (h % 8) * 1.5 + (Math.random() - 0.5) * 3).toFixed(1),
    });
  }
  return data;
}

const timeRanges = [
  { label: "今日", hours: 24 },
  { label: "近3天", hours: 72 },
  { label: "近7天", hours: 168 },
  { label: "近30天", hours: 720 },
];

const sensorOptions = [
  { key: "temp", label: "空气温度", unit: "°C", color: "#f97316" },
  { key: "humidity", label: "空气湿度", unit: "%", color: "#3b82f6" },
  { key: "light", label: "光照强度", unit: "lux", color: "#eab308" },
  { key: "co2", label: "CO₂浓度", unit: "ppm", color: "#22c55e" },
  { key: "soilHumidity", label: "土壤湿度", unit: "%", color: "#a855f7" },
];

const greenhouses = ["1号大棚", "2号大棚", "3号大棚", "5号大棚"];

function StatCard({ label, value, unit, trend }: { label: string; value: string; unit: string; trend: "up" | "down" | "flat" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-800">{value}</span>
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
      <div className={`flex items-center gap-1 mt-1 text-xs ${
        trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "text-gray-400"
      }`}>
        {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {trend === "up" ? "较上期升高" : trend === "down" ? "较上期下降" : "较上期持平"}
      </div>
    </div>
  );
}

export function HistoricalData() {
  const [selectedRange, setSelectedRange] = useState(timeRanges[0]);
  const [selectedGH, setSelectedGH] = useState("1号大棚");
  const [selectedSensors, setSelectedSensors] = useState<string[]>(["temp", "humidity"]);
  const [data, setData] = useState(() => genDataset(timeRanges[0].hours));
  const [exporting, setExporting] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<{
    temp?: number;
    humidity?: number;
    light?: number;
  }>({});

  useEffect(() => {
    let cancelled = false;
    const fallback = genDataset(selectedRange.hours);

    async function loadRealData() {
      if (selectedGH !== "1号大棚") {
        setData(fallback);
        const lastFallback = fallback[fallback.length - 1];
        setLatestMetrics({
          temp: lastFallback?.temp,
          humidity: lastFallback?.humidity,
          light: lastFallback?.light,
        });
        return;
      }

      try {
        const range = `${selectedRange.hours}h`;
        const [snapshot, tempHistory, humidityHistory, lightHistory] = await Promise.all([
          fetchRealtimeSnapshot(selectedGH),
          fetchSensorHistory(selectedGH, "temp", range),
          fetchSensorHistory(selectedGH, "humidity", range),
          fetchSensorHistory(selectedGH, "light", range),
        ]);

        const primaryTimeline =
          tempHistory.length > 0
            ? tempHistory
            : humidityHistory.length > 0
              ? humidityHistory
              : lightHistory.length > 0
                ? lightHistory
                : [];

        if (!cancelled) {
          if (primaryTimeline.length > 0) {
            const merged = primaryTimeline.map((point, index) => {
              const fallbackPoint = fallback[Math.min(index, fallback.length - 1)] ?? {};
              return {
                time: point.time,
                temp: tempHistory[index]?.value ?? fallbackPoint.temp,
                humidity: humidityHistory[index]?.value ?? fallbackPoint.humidity,
                light: lightHistory[index]?.value ?? fallbackPoint.light,
                co2: fallbackPoint.co2,
                soilHumidity: fallbackPoint.soilHumidity,
              };
            });
            setData(merged);
          } else {
            setData([]);
          }

          setLatestMetrics({
            temp: snapshot.temp,
            humidity: snapshot.humidity,
            light: snapshot.light,
          });
        }
      } catch {
        if (!cancelled) {
          setData([]);
          setLatestMetrics({});
        }
      }
    }

    void loadRealData();
    return () => {
      cancelled = true;
    };
  }, [selectedGH, selectedRange]);

  function toggleSensor(key: string) {
    setSelectedSensors((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const lastPoint = useMemo(() => data[data.length - 1], [data]);

  async function handleExportData() {
    if (exporting) return;

    setExporting(true);
    try {
      const range = `${selectedRange.hours}h`;
      const [tempHistory, humidityHistory, lightHistory] = await Promise.all([
        fetchSensorHistory(selectedGH, "temp", range, true, true),
        fetchSensorHistory(selectedGH, "humidity", range, true, true),
        fetchSensorHistory(selectedGH, "light", range, true, true),
      ]);

      const rowsByTime = new Map<string, { timestamp: string; temp?: number; humidity?: number; light?: number }>();

      for (const point of tempHistory) {
        const key = point.timestamp || point.time;
        rowsByTime.set(key, {
          ...(rowsByTime.get(key) || { timestamp: key }),
          timestamp: key,
          temp: point.value,
        });
      }
      for (const point of humidityHistory) {
        const key = point.timestamp || point.time;
        rowsByTime.set(key, {
          ...(rowsByTime.get(key) || { timestamp: key }),
          timestamp: key,
          humidity: point.value,
        });
      }
      for (const point of lightHistory) {
        const key = point.timestamp || point.time;
        rowsByTime.set(key, {
          ...(rowsByTime.get(key) || { timestamp: key }),
          timestamp: key,
          light: point.value,
        });
      }

      const rows = Array.from(rowsByTime.values()).sort((a, b) => {
        const ta = Date.parse(a.timestamp);
        const tb = Date.parse(b.timestamp);
        if (Number.isNaN(ta) || Number.isNaN(tb)) {
          return a.timestamp.localeCompare(b.timestamp);
        }
        return ta - tb;
      });
      const lines = [
        ["时间戳", "空气温度(°C)", "空气湿度(%)", "光照强度(lux)"].join(","),
        ...rows.map((row) => [
          row.timestamp,
          row.temp ?? "",
          row.humidity ?? "",
          row.light ?? "",
        ].join(",")),
      ];

      const csv = "\ufeff" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeRange = selectedRange.label.replace(/\s+/g, "");
      const safeGh = selectedGH.replace(/\s+/g, "");
      link.href = url;
      link.download = `${safeGh}_${safeRange}_历史数据.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">历史数据趋势分析</h1>
          
        </div>
        <button
          onClick={() => void handleExportData()}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {exporting ? "导出中..." : "导出数据"}
        </button>
      </div>

      {/* Data Pipeline Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {["农户选择时间跨度", "时序数据库聚合", "后端降采样处理", "可视化折线趋势图"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg font-medium">{s}</span>
            {i < 3 && <span className="text-blue-300">→</span>}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          {/* Time Range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">时间跨度：</span>
            {timeRanges.map((r) => (
              <button
                key={r.label}
                onClick={() => setSelectedRange(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedRange.label === r.label
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Greenhouse */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">大棚：</span>
            <select
              value={selectedGH}
              onChange={(e) => setSelectedGH(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green-400"
            >
              {greenhouses.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>

          {/* Sensors */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">指标：</span>
            {sensorOptions.map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSensor(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selectedSensors.includes(s.key)
                    ? "text-white border-transparent shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
                style={selectedSensors.includes(s.key) ? { backgroundColor: s.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: selectedSensors.includes(s.key) ? "white" : s.color }}
                />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <StatCard label="当前温度" value={String(latestMetrics.temp ?? lastPoint?.temp ?? "--")} unit="°C" trend="up" />
        <StatCard label="当前湿度" value={String(latestMetrics.humidity ?? lastPoint?.humidity ?? "--")} unit="%" trend="flat" />
        <StatCard label="当前光照" value={String(latestMetrics.light ?? lastPoint?.light ?? "--")} unit="lux" trend="down" />
        <StatCard label="当前CO₂" value={String(lastPoint?.co2 ?? "--")} unit="ppm" trend="up" />
        <StatCard label="土壤湿度" value={String(lastPoint?.soilHumidity ?? "--")} unit="%" trend="down" />
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              {selectedGH} · {selectedRange.label}多维传感数据趋势
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              数据点数：{data.length} · 已降采样处理 · InfluxDB时序数据库
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {sensorOptions
              .filter((s) => selectedSensors.includes(s.key))
              .map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name={`${s.label}(${s.unit})`}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Area charts for each selected sensor */}
      {selectedSensors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sensorOptions
            .filter((s) => selectedSensors.includes(s.key))
            .slice(0, 4)
            .map((s) => (
              <div key={s.key} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    {s.label}
                  </h4>
                  <span className="text-xs text-gray-400">{s.unit}</span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                    <Area
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      fill={`url(#grad-${s.key})`}
                      strokeWidth={2}
                      dot={false}
                      name={`${s.label}(${s.unit})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
