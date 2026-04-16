import { withApiBase } from "../lib/env";

export const SENSOR_KEYS = [
  "temp",
  "humidity",
  "light",
  "co2",
  "soilHumidity",
  "soilTemp",
] as const;

export type SensorKey = (typeof SENSOR_KEYS)[number];

export type SensorMetrics = Partial<Record<SensorKey, number>>;

export type SensorPoint = {
  time: string;
  timestamp: string;
  value: number;
};

function pickNumericMetrics(input: Record<string, unknown>): SensorMetrics {
  const metrics: SensorMetrics = {};
  for (const key of SENSOR_KEYS) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      metrics[key] = value;
    }
  }
  return metrics;
}

function normalizeMetrics(payload: unknown): SensorMetrics {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const raw = payload as Record<string, unknown>;
  if (raw.metrics && typeof raw.metrics === "object") {
    return pickNumericMetrics(raw.metrics as Record<string, unknown>);
  }

  return pickNumericMetrics(raw);
}

export async function fetchRealtimeSnapshot(greenhouse: string): Promise<SensorMetrics> {
  const url = withApiBase(`/api/greenhouses/${encodeURIComponent(greenhouse)}/realtime`);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Realtime snapshot request failed: ${res.status}`);
  }

  const payload = await res.json();
  return normalizeMetrics(payload);
}

export async function fetchSensorHistory(
  greenhouse: string,
  sensor: SensorKey,
  range = "24h",
  aggregate = true,
  fixedSlots = false,
): Promise<SensorPoint[]> {
  const url = withApiBase(
    `/api/greenhouses/${encodeURIComponent(greenhouse)}/history?sensor=${sensor}&range=${range}&aggregate=${aggregate}&fixedSlots=${fixedSlots}`,
  );
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`History request failed: ${res.status}`);
  }

  const payload = await res.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((point) => {
      if (!point || typeof point !== "object") {
        return null;
      }

      const raw = point as Record<string, unknown>;
      const timestamp =
        typeof raw.timestamp === "string"
          ? raw.timestamp
          : "";
      const time =
        typeof raw.time === "string"
          ? raw.time
          : timestamp
            ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
      const numericValue =
        typeof raw.value === "number"
          ? raw.value
          : typeof raw.val === "number"
            ? raw.val
            : NaN;

      if (!time || !Number.isFinite(numericValue)) {
        return null;
      }

      return {
        time,
        timestamp,
        value: Number(numericValue),
      };
    })
    .filter((point): point is SensorPoint => Boolean(point));
}

export function connectRealtimeStream(
  greenhouse: string,
  onMetrics: (metrics: SensorMetrics) => void,
  _onError?: (err: Event) => void,
) {
  const pull = async () => {
    try {
      const metrics = await fetchRealtimeSnapshot(greenhouse);
      if (Object.keys(metrics).length > 0) {
        onMetrics(metrics);
      }
    } catch {
      // Ignore polling errors and allow UI fallback logic to decide status.
    }
  };

  void pull();
  const timer = window.setInterval(pull, 5000);

  return {
    connected: true,
    close: () => {
      window.clearInterval(timer);
    },
  };
}
