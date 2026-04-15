import { withApiBase, withWsBase } from "../lib/env";

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
): Promise<SensorPoint[]> {
  const url = withApiBase(
    `/api/greenhouses/${encodeURIComponent(greenhouse)}/history?sensor=${sensor}&range=${range}`,
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
      const time =
        typeof raw.time === "string"
          ? raw.time
          : typeof raw.timestamp === "string"
            ? new Date(raw.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
        value: Number(numericValue),
      };
    })
    .filter((point): point is SensorPoint => Boolean(point));
}

export function connectRealtimeStream(
  greenhouse: string,
  onMetrics: (metrics: SensorMetrics) => void,
  onError?: (err: Event) => void,
) {
  const wsUrl = withWsBase(`/ws/realtime?greenhouse=${encodeURIComponent(greenhouse)}`);
  if (!wsUrl) {
    return {
      connected: false,
      close: () => {
        // no-op
      },
    };
  }

  const ws = new WebSocket(wsUrl);
  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      const metrics = normalizeMetrics(payload);
      if (Object.keys(metrics).length > 0) {
        onMetrics(metrics);
      }
    } catch {
      // Ignore malformed messages to keep stream resilient.
    }
  };

  if (onError) {
    ws.onerror = onError;
  }

  return {
    connected: true,
    close: () => ws.close(),
  };
}
