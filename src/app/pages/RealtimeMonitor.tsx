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
  type SensorMetrics,
  type SensorPoint,
  connectRealtimeStream,
  fetchRealtimeSnapshot,
  fetchSensorHistory,
} from "../services/realtime";
import { fetchThresholdRules, type ThresholdRule } from "../services/thresholdAlert";

const greenhouses = ["1号大棚", "2号大棚", "3号大棚", "4号大棚", "5号大棚", "6号大棚"];

/**
 * 以 1号大棚的真实数据为基线，为其余大棚生成“靠谱的”模拟数据。
 * - 各大棚有固定偏移，体现不同阔叶面积/朝向/作物差异
 * - 在偏移上叠加 ±5% 带种子的微抖动，避免多个大棚看起来一模一样
 */
const SIM_OFFSETS: Record<string, Partial<Record<SensorKey, { delta?: number; scale?: number }>>> = {
  "2号大棚": { temp: { delta: 1.2 }, humidity: { delta: -3 }, light: { scale: 0.95 }, co2: { delta: 20 }, soilHumidity: { delta: -5 }, soilTemp: { delta: 0.8 } },
  "3号大棚": { temp: { delta: -0.8 }, humidity: { delta: 4 }, light: { scale: 1.05 }, co2: { delta: -15 }, soilHumidity: { delta: 6 }, soilTemp: { delta: -0.5 } },
  "4号大棚": { temp: { delta: 2.0 }, humidity: { delta: -6 }, light: { scale: 1.10 }, co2: { delta: 35 }, soilHumidity: { delta: -8 }, soilTemp: { delta: 1.5 } },
  "5号大棚": { temp: { delta: -1.5 }, humidity: { delta: 2 }, light: { scale: 0.90 }, co2: { delta: -10 }, soilHumidity: { delta: 3 }, soilTemp: { delta: -1.0 } },
  "6号大棚": { temp: { delta: 0.5 }, humidity: { delta: -1 }, light: { scale: 1.02 }, co2: { delta: 5 }, soilHumidity: { delta: -2 }, soilTemp: { delta: 0.3 } },
};

// 简单确定性随机（项目中不需要加密，仅需多大棚微抖动不同步）
function seededJitter(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x); // [0,1)
}

function simulateValue(gh: string, key: SensorKey, base: number, seed = Date.now()): number {
  const cfg = SIM_OFFSETS[gh]?.[key];
  let v = base;
  if (cfg?.scale != null) v *= cfg.scale;
  if (cfg?.delta != null) v += cfg.delta;
  // ±3% 随机抖动（加入 gh 名称哈希 + seed，让不同大棚不同步）
  const ghSeed = gh.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const noise = (seededJitter(ghSeed * 991 + (seed % 100000)) - 0.5) * 0.06; // ±3%
  v *= 1 + noise;
  return +v.toFixed(2);
}

function simulateMetrics(gh: string, base: SensorMetrics, seed = Date.now()): SensorMetrics {
  if (gh === ONLINE_GREENHOUSE) return base;
  const out: SensorMetrics = {};
  for (const key of SENSOR_KEYS) {
    const v = base[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = simulateValue(gh, key, v, seed);
    }
  }
  return out;
}

function simulateHistory(gh: string, key: SensorKey, basePoints: SensorPoint[]): SensorPoint[] {
  if (gh === ONLINE_GREENHOUSE) return basePoints;
  return basePoints.map((p, i) => ({
    ...p,
    value: simulateValue(gh, key, p.value, i * 100 + 1),
  }));
}

/**
 * 从阈值告警规则提取「每个大棚 × 每个传感器」的有效 [min,max] 区间。
 * 设备命名约定: DEV-GH{02d}-{T01|H01|L01|C01|S01|G01}
 * 后端只支持 temp/humidity/light/co2 三个 metric，soilHumidity/soilTemp 未产生规则时返回 undefined，调用方回退默认 normal。
 */
const METRIC_TO_SUFFIX: Record<string, SensorKey> = {
  T01: "temp",
  H01: "humidity",
  L01: "light",
  C01: "co2",
  S01: "soilHumidity",
  G01: "soilTemp",
};
function parseDeviceId(deviceId: string): { gh: string; sensorKey: SensorKey } | null {
  const m = /^DEV-GH(\d{1,2})-([A-Z]\d{2})$/.exec(deviceId);
  if (!m) return null;
  const ghNo = String(parseInt(m[1], 10));
  const sensorKey = METRIC_TO_SUFFIX[m[2]];
  if (!sensorKey) return null;
  return { gh: `${ghNo}号大棚`, sensorKey };
}

type RangeMap = Record<string, Partial<Record<SensorKey, [number, number]>>>;
function buildRangeMap(rules: ThresholdRule[]): RangeMap {
  const map: RangeMap = {};
  for (const r of rules) {
    if (!r.enabled) continue;
    const parsed = parseDeviceId(r.deviceId);
    if (!parsed) continue;
    // 后端 metric 与 SensorKey 应一致（temp/humidity/light/co2），以 deviceId 解析为准
    const { gh, sensorKey } = parsed;
    if (!map[gh]) map[gh] = {};
    const cur = map[gh][sensorKey];
    if (r.operator === "BELOW") {
      // BELOW 阈值 → 低于此值报警，即这是 “正常下限”
      const min = r.threshold;
      const max = cur ? cur[1] : Number.POSITIVE_INFINITY;
      map[gh][sensorKey] = [min, max];
    } else if (r.operator === "ABOVE") {
      const min = cur ? cur[0] : Number.NEGATIVE_INFINITY;
      const max = r.threshold;
      map[gh][sensorKey] = [min, max];
    }
  }
  return map;
}

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
    normal: [100, 1000],
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

type ConnectionMode = "live" | "waiting" | "offline";

const ONLINE_GREENHOUSE = "1号大棚";

const defaultSensorValues = sensorConfigs.reduce<Record<SensorKey, number>>((acc, sensor) => {
  acc[sensor.key as SensorKey] = sensor.defaultValue;
  return acc;
}, {} as Record<SensorKey, number>);

const emptySensorValues = sensorConfigs.reduce<Partial<Record<SensorKey, number>>>((acc, sensor) => {
  acc[sensor.key as SensorKey] = undefined;
  return acc;
}, {} as Partial<Record<SensorKey, number>>);

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
  const initialGH = new URLSearchParams(window.location.search).get("gh");
  const safeInitialGH = initialGH && greenhouses.includes(initialGH) ? initialGH : "1号大棚";
  const [selectedGH, setSelectedGH] = useState(safeInitialGH);
  const [selectedSensor, setSelectedSensor] = useState<SensorKey>("temp");
  const [sensorValues, setSensorValues] = useState<Partial<Record<SensorKey, number>>>(
    safeInitialGH === ONLINE_GREENHOUSE ? emptySensorValues : emptySensorValues,
  );
  const [sensorSeries, setSensorSeries] = useState<Record<SensorKey, SensorPoint[]>>(defaultSensorSeries);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(
    safeInitialGH === ONLINE_GREENHOUSE ? "waiting" : "offline",
  );
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [thresholdRanges, setThresholdRanges] = useState<RangeMap>({});

  // 全局轮询阈值规则（不随大棚切换重启）
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const rules = await fetchThresholdRules();
        if (!cancelled) setThresholdRanges(buildRangeMap(rules || []));
      } catch {
        /* 获取失败时保留原范围，不报错 */
      }
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // 计算当前大棚的有效 normal 区间：优先用阈值规则，其次用 sensorConfigs.normal 默认值
  const effectiveNormal = useMemo<Record<SensorKey, [number, number]>>(() => {
    const out = {} as Record<SensorKey, [number, number]>;
    const ghRanges = thresholdRanges[selectedGH] || {};
    for (const sensor of sensorConfigs) {
      const k = sensor.key as SensorKey;
      const fromRule = ghRanges[k];
      out[k] = fromRule ?? (sensor.normal as [number, number]);
    }
    return out;
  }, [thresholdRanges, selectedGH]);

  const activeSensor = useMemo(
    () => sensorConfigs.find((s) => s.key === selectedSensor)!,
    [selectedSensor],
  );

  useEffect(() => {
    let disposed = false;
    const isSimulated = selectedGH !== ONLINE_GREENHOUSE;

    setConnectionMode("waiting");
    setSensorValues(emptySensorValues);
    setSensorSeries((prev) => {
      const next = { ...prev };
      for (const key of SENSOR_KEYS) {
        next[key] = [];
      }
      return next;
    });

    async function hydrateFromBackend() {
      try {
        // 始终从 1 号大棚拉真实数据，非 1 号大棚做模拟变换
        const baseSnapshot = await fetchRealtimeSnapshot(ONLINE_GREENHOUSE);
        if (!disposed && Object.keys(baseSnapshot).length > 0) {
          const snapshot = isSimulated ? simulateMetrics(selectedGH, baseSnapshot) : baseSnapshot;
          setConnectionMode("live");
          setSensorValues((prev) => ({ ...prev, ...snapshot }));
          setLastUpdated(new Date());
        } else if (!disposed) {
          setConnectionMode("waiting");
          setSensorValues(emptySensorValues);
        }

        const historyResults = await Promise.all(
          SENSOR_KEYS.map(async (key) => ({
            key,
            points: await fetchSensorHistory(ONLINE_GREENHOUSE, key),
          })),
        );
        if (!disposed) {
          const nextSeries = { ...defaultSensorSeries };
          for (const item of historyResults) {
            if (item.points.length > 0) {
              nextSeries[item.key] = isSimulated
                ? simulateHistory(selectedGH, item.key, item.points)
                : item.points;
            } else {
              nextSeries[item.key] = [];
            }
          }
          setSensorSeries(nextSeries);
        }
      } catch {
        if (!disposed) {
          setConnectionMode("waiting");
          setSensorValues(emptySensorValues);
        }
      }
    }

    hydrateFromBackend();

    // 始终订阅 1号大棚的实时流；如果是模拟大棚，对每帧做变换后再写入
    const stream = connectRealtimeStream(
      ONLINE_GREENHOUSE,
      (metrics) => {
        if (disposed) {
          return;
        }
        const transformed = isSimulated ? simulateMetrics(selectedGH, metrics) : metrics;

        setConnectionMode("live");
        setLastUpdated(new Date());
        setSensorValues((prev) => ({ ...prev, ...transformed }));
        setSensorSeries((prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(transformed)) {
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
          setConnectionMode("waiting");
        }
      },
    );

    if (!stream.connected) {
      setConnectionMode("waiting");
    }

    return () => {
      disposed = true;
      stream.close();
    };
  }, [selectedGH]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
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
                : connectionMode === "waiting"
                  ? "text-blue-700 bg-blue-50 border-blue-200"
                  : "text-gray-700 bg-gray-50 border-gray-200"
            }`}
          >
            <Wifi className={`w-3.5 h-3.5 ${connectionMode === "live" ? "animate-pulse" : ""}`} />
            {connectionMode === "live"
              ? "实时数据已连接"
              : connectionMode === "waiting"
                ? "等待真实数据"
                : "当前大棚离线"}
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
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sensorConfigs.map((sensor) => {
          const isSelected = sensor.key === selectedSensor;
          const rawValue = sensorValues[sensor.key as SensorKey];
          const hasRealValue = typeof rawValue === "number" && Number.isFinite(rawValue);
          const displayValue = hasRealValue
            ? rawValue.toFixed(sensor.key === "light" || sensor.key === "co2" ? 0 : 1)
            : "--";
          const isNormal = hasRealValue && rawValue >= effectiveNormal[sensor.key as SensorKey][0] && rawValue <= effectiveNormal[sensor.key as SensorKey][1];

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
                    !hasRealValue
                      ? "bg-gray-100 text-gray-500"
                      : isNormal
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                  }`}
                >
                  {!hasRealValue ? "无数据" : isNormal ? "正常" : "⚠ 异常"}
                </span>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">{sensor.label}</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-gray-800">{displayValue}</span>
                  <span className="text-sm text-gray-400">{sensor.unit}</span>
                </div>
              </div>
              {hasRealValue ? (
                <GaugeBar
                  value={rawValue}
                  min={sensor.min}
                  max={sensor.max}
                  normal={effectiveNormal[sensor.key as SensorKey]}
                  color={sensor.color}
                />
              ) : (
                <div className="mt-2 text-xs text-gray-400">
                  {connectionMode === "offline" ? "当前大棚离线" : "等待真实数据上报"}
                </div>
              )}
              <div className="mt-1.5 text-[10px] text-gray-400 flex items-center justify-between">
                <span>正常区间</span>
                <span className="font-mono">
                  {effectiveNormal[sensor.key as SensorKey][0]} ~ {effectiveNormal[sensor.key as SensorKey][1]} {sensor.unit}
                </span>
                <span className={`px-1 rounded ${thresholdRanges[selectedGH]?.[sensor.key as SensorKey] ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                  {thresholdRanges[selectedGH]?.[sensor.key as SensorKey] ? "已配规则" : "默认"}
                </span>
              </div>
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
          <LineChart data={sensorSeries[selectedSensor] || []}>
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
              desc: connectionMode === "live" ? "云平台网关" : connectionMode === "waiting" ? "等待设备上报" : "当前大棚离线",
            },
            {
              step: "后端解析",
              status: connectionMode === "live" ? "ok" : "pending",
              desc: connectionMode === "live" ? "数据合法性校验" : connectionMode === "waiting" ? "等待真实数据源" : "未收到离线大棚数据",
            },
            { step: "缓存写入", status: "ok", desc: "Redis + InfluxDB" },
            {
              step: "前端展示",
              status: "ok",
              desc: connectionMode === "live" ? "HTTP实时拉取" : connectionMode === "waiting" ? "显示空态" : "离线空态展示",
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
