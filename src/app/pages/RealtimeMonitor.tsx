import { useEffect, useMemo, useState } from "react";
import {
  Thermometer,
  Droplets,
  Sun,
  Wind,
  Gauge,
  Leaf,
  Activity,
  Wifi,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  SENSOR_KEYS,
  type SensorKey,
  type SensorPoint,
  connectRealtimeStream,
  fetchRealtimeSnapshot,
  fetchSensorHistory,
} from "../services/realtime";
import { useSearchParams } from "react-router";

const greenhouses = ["1号大棚", "2号大棚", "3号大棚", "5号大棚", "6号大棚"];

function generateData(base: number, variance: number, points: number) {
  return Array.from({ length: points }, (_, i) => ({
    time: `${String(Math.floor(i * (24 / points))).padStart(2, "0")}:${String((i * 4) % 60).padStart(2, "0")}`,
    value: +(base + (Math.random() - 0.5) * variance * 2).toFixed(1),
  }));
}

const sensorConfigs = [
  {
    key: "temp",
    label: "空气温度",
    unit: "°C",
    icon: Thermometer,
    color: "#f97316",
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    min: 15,
    max: 35,
    normal: [18, 30],
    defaultValue: 24.5,
    defaultData: generateData(24, 3, 24),
  },
  {
    key: "humidity",
    label: "空气湿度",
    unit: "%",
    icon: Droplets,
    color: "#3b82f6",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    min: 0,
    max: 100,
    normal: [50, 80],
    defaultValue: 68,
    defaultData: generateData(68, 8, 24),
  },
  {
    key: "light",
    label: "光照强度",
    unit: "lux",
    icon: Sun,
    color: "#eab308",
    iconColor: "text-yellow-500",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    min: 0,
    max: 15000,
    normal: [3000, 12000],
    defaultValue: 8500,
    defaultData: generateData(8500, 2000, 24),
  },
  {
    key: "co2",
    label: "CO₂浓度",
    unit: "ppm",
    icon: Wind,
    color: "#22c55e",
    iconColor: "text-green-500",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    min: 300,
    max: 800,
    normal: [350, 600],
    defaultValue: 420,
    defaultData: generateData(420, 50, 24),
  },
  {
    key: "soilHumidity",
    label: "土壤湿度",
    unit: "%",
    icon: Leaf,
    color: "#10b981",
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    min: 0,
    max: 100,
    normal: [30, 70],
    defaultValue: 45,
    defaultData: generateData(45, 10, 24),
  },
  {
    key: "soilTemp",
    label: "土壤温度",
    unit: "°C",
    icon: Gauge,
    color: "#a855f7",
    iconColor: "text-purple-500",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    min: 10,
    max: 40,
    normal: [15, 30],
    defaultValue: 21.2,
    defaultData: generateData(21, 2, 24),
  },
] as const;

type ConnectionMode = "live" | "mock";

const defaultSensorValues = sensorConfigs.reduce<Record<SensorKey, number>>((acc, sensor) => {
  acc[sensor.key as SensorKey] = sensor.defaultValue;
  return acc;
}, {} as Record<SensorKey, number>);

const defaultSensorSeries = sensorConfigs.reduce<Record<SensorKey, SensorPoint[]>>((acc, sensor) => {
  acc[sensor.key as SensorKey] = sensor.defaultData;
  return acc;
}, {} as Record<SensorKey, SensorPoint[]>);

function toClockTime(input: Date) {
  return input.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function rollSeries(points: SensorPoint[], value: number, maxPoints = 48) {
  const next = [...points, { time: toClockTime(new Date()), value: +value.toFixed(2) }];
  return next.slice(Math.max(0, next.length - maxPoints));
}

function GaugeBar({ value, min, max, normal, color }: {
  value: number; min: number; max: number; normal: [number, number]; color: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const isNormal = value >= normal[0] && value <= normal[1];
  return (
    <div className="mt-2">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: isNormal ? color : "#ef4444" }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{min}</span>
        <span className={`font-medium ${isNormal ? "text-green-600" : "text-red-500"}`}>
          {isNormal ? "正常" : "异常"}
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function RealtimeMonitor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGH = searchParams.get("gh");
  const safeInitialGH = initialGH && greenhouses.includes(initialGH) ? initialGH : "1号大棚";
  const [selectedGH, setSelectedGH] = useState(safeInitialGH);
  const [selectedSensor, setSelectedSensor] = useState<SensorKey>("temp");
  const [sensorValues, setSensorValues] = useState<Record<SensorKey, number>>(defaultSensorValues);
  const [sensorSeries, setSensorSeries] = useState<Record<SensorKey, SensorPoint[]>>(defaultSensorSeries);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("mock");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const activeSensor = useMemo(
    () => sensorConfigs.find((s) => s.key === selectedSensor)!,
    [selectedSensor],
  );

  useEffect(() => {
    const ghInUrl = searchParams.get("gh");
    if (ghInUrl && greenhouses.includes(ghInUrl) && ghInUrl !== selectedGH) {
      setSelectedGH(ghInUrl);
    }
  }, [searchParams, selectedGH]);

  useEffect(() => {
    const ghInUrl = searchParams.get("gh");
    if (ghInUrl === selectedGH) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("gh", selectedGH);
    setSearchParams(next, { replace: true });
  }, [selectedGH, searchParams, setSearchParams]);

  useEffect(() => {
    let disposed = false;

    async function hydrateFromBackend() {
      try {
        const snapshot = await fetchRealtimeSnapshot(selectedGH);
        if (!disposed && Object.keys(snapshot).length > 0) {
          setSensorValues((prev) => ({ ...prev, ...snapshot }));
          setLastUpdated(new Date());
        }

        const historyResults = await Promise.all(
          SENSOR_KEYS.map(async (key) => ({
            key,
            points: await fetchSensorHistory(selectedGH, key),
          })),
        );
        if (!disposed) {
          const nextSeries = { ...defaultSensorSeries };
          for (const item of historyResults) {
            if (item.points.length > 0) {
              nextSeries[item.key] = item.points;
            }
          }
          setSensorSeries(nextSeries);
        }
      } catch {
        // Keep mock mode when backend is unavailable.
      }
    }

    hydrateFromBackend();

    const stream = connectRealtimeStream(
      selectedGH,
      (metrics) => {
        if (disposed) {
          return;
        }

        setConnectionMode("live");
        setLastUpdated(new Date());
        setSensorValues((prev) => ({ ...prev, ...metrics }));
        setSensorSeries((prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(metrics)) {
            if (typeof value === "number" && Number.isFinite(value)) {
              const sensorKey = key as SensorKey;
              next[sensorKey] = rollSeries(next[sensorKey] || [], value);
            }
          }
          return next;
        });
      },
      () => {
        if (!disposed) {
          setConnectionMode("mock");
        }
      },
    );

    if (!stream.connected) {
      setConnectionMode("mock");
    }

    return () => {
      disposed = true;
      stream.close();
    };
  }, [selectedGH]);

  useEffect(() => {
    if (connectionMode !== "mock") {
      return;
    }

    const timer = setInterval(() => {
      setSensorValues((prev) => {
        const next = { ...prev };
        for (const sensor of sensorConfigs) {
          const key = sensor.key as SensorKey;
          const variance = key === "light" ? 80 : key === "co2" ? 5 : 0.3;
          const value = next[key] + (Math.random() - 0.5) * variance;
          next[key] = +value.toFixed(key === "light" || key === "co2" ? 0 : 2);
        }

        setSensorSeries((prevSeries) => {
          const nextSeries = { ...prevSeries };
          for (const sensor of sensorConfigs) {
            const key = sensor.key as SensorKey;
            nextSeries[key] = rollSeries(nextSeries[key] || [], next[key]);
          }
          return nextSeries;
        });

        return next;
      });

      setLastUpdated(new Date());
    }, 3000);

    return () => clearInterval(timer);
  }, [connectionMode]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">全指标实时环境监测</h1>
          
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
              connectionMode === "live"
                ? "text-green-600 bg-green-50 border-green-200"
                : "text-amber-700 bg-amber-50 border-amber-200"
            }`}
          >
            <Wifi className={`w-3.5 h-3.5 ${connectionMode === "live" ? "animate-pulse" : ""}`} />
            {connectionMode === "live" ? "WebSocket 已连接" : "模拟数据模式"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
            <Activity className="w-3.5 h-3.5" />
            最近更新：{toClockTime(lastUpdated)}
          </div>
        </div>
      </div>

      {/* Greenhouse Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 mr-1">选择大棚：</span>
        {greenhouses.map((gh) => (
          <button
            key={gh}
            onClick={() => setSelectedGH(gh)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedGH === gh
                ? "bg-green-600 text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
            }`}
          >
            {gh}
          </button>
        ))}
      </div>

      {/* Sensor Cards */}
      <div className="grid grid-cols-3 gap-4">
        {sensorConfigs.map((sensor) => {
          const isSelected = sensor.key === selectedSensor;
          const rawValue = sensorValues[sensor.key as SensorKey] ?? sensor.defaultValue;
          const displayValue = rawValue.toFixed(sensor.key === "light" || sensor.key === "co2" ? 0 : 1);
          const isNormal = rawValue >= sensor.normal[0] && rawValue <= sensor.normal[1];

          return (
            <div
              key={sensor.key}
              onClick={() => setSelectedSensor(sensor.key)}
              className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? `${sensor.borderColor} shadow-md`
                  : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-xl ${sensor.bgColor}`}>
                  <sensor.icon className={`w-5 h-5 ${sensor.iconColor}`} />
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isNormal ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  }`}
                >
                  {isNormal ? "正常" : "⚠ 异常"}
                </span>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">{sensor.label}</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-gray-800">{displayValue}</span>
                  <span className="text-sm text-gray-400">{sensor.unit}</span>
                </div>
              </div>
              <GaugeBar
                value={rawValue}
                min={sensor.min}
                max={sensor.max}
                normal={sensor.normal as [number, number]}
                color={sensor.color}
              />
            </div>
          );
        })}
      </div>

      {/* Detail Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              {selectedGH} · {activeSensor.label} 今日变化趋势
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">数据采集频率：每30秒一次</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-6 h-1 rounded" style={{ backgroundColor: activeSensor.color, display: "inline-block" }} />
              {activeSensor.label}（{activeSensor.unit}）
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={sensorSeries[selectedSensor] || activeSensor.defaultData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val: number) => [`${val} ${activeSensor.unit}`, activeSensor.label]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={activeSensor.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data Flow Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">数据链路状态</h3>
        <div className="flex items-center gap-3">
          {[
            { step: "传感器采集", status: "ok", desc: "GH-01传感器组" },
            {
              step: "MQTT上传",
              status: connectionMode === "live" ? "ok" : "pending",
              desc: connectionMode === "live" ? "云平台网关" : "后端未接入，模拟中",
            },
            {
              step: "后端解析",
              status: connectionMode === "live" ? "ok" : "pending",
              desc: connectionMode === "live" ? "数据合法性校验" : "等待真实数据源",
            },
            { step: "缓存写入", status: "ok", desc: "Redis + InfluxDB" },
            {
              step: "前端展示",
              status: "ok",
              desc: connectionMode === "live" ? "WebSocket推送" : "本地模拟推送",
            },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-full text-center text-xs py-2 px-2 rounded-lg font-medium ${
                  s.status === "ok"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {s.step}
                </div>
                <div className="text-xs text-gray-400 mt-1 text-center">{s.desc}</div>
              </div>
              {i < 4 && <div className="text-gray-300 text-lg flex-shrink-0">→</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
