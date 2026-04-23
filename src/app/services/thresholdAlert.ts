const THRESHOLD_ALERT_BASE = "/api/v1/threshold-alert";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type ThresholdOperator = "ABOVE" | "BELOW";

export interface ThresholdRule {
  id: number;
  deviceId: string;
  metric: string;
  operator: ThresholdOperator;
  threshold: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ThresholdRuleRequest {
  deviceId: string;
  metric: string;
  operator: ThresholdOperator;
  threshold: number;
  enabled?: boolean;
}

export interface ThresholdAlertRecord {
  id: number;
  ruleId: number;
  deviceId: string;
  metric: string;
  operator: ThresholdOperator;
  threshold: number;
  currentValue: number;
  message: string;
  alertedAt: string;
}

async function toJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchThresholdRules(): Promise<ThresholdRule[]> {
  const res = await fetch(`${THRESHOLD_ALERT_BASE}/rules`);
  const json = await toJson<ApiResponse<ThresholdRule[]>>(res);
  return json.data;
}

export async function createThresholdRule(req: ThresholdRuleRequest): Promise<ThresholdRule> {
  const res = await fetch(`${THRESHOLD_ALERT_BASE}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json = await toJson<ApiResponse<ThresholdRule>>(res);
  return json.data;
}

export async function updateThresholdRule(id: number, req: ThresholdRuleRequest): Promise<ThresholdRule> {
  const res = await fetch(`${THRESHOLD_ALERT_BASE}/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json = await toJson<ApiResponse<ThresholdRule>>(res);
  return json.data;
}

export async function toggleThresholdRule(id: number, enabled: boolean): Promise<void> {
  await toJson<ApiResponse<string>>(
    await fetch(`${THRESHOLD_ALERT_BASE}/rules/${id}/toggle?enabled=${enabled}`, {
      method: "PATCH",
    })
  );
}

export async function deleteThresholdRule(id: number): Promise<void> {
  await toJson<ApiResponse<string>>(
    await fetch(`${THRESHOLD_ALERT_BASE}/rules/${id}`, {
      method: "DELETE",
    })
  );
}

export async function fetchThresholdAlertRecords(): Promise<ThresholdAlertRecord[]> {
  const res = await fetch(`${THRESHOLD_ALERT_BASE}/records`);
  const json = await toJson<ApiResponse<ThresholdAlertRecord[]>>(res);
  return json.data;
}

export async function runThresholdCheckNow(): Promise<void> {
  await toJson<ApiResponse<string>>(
    await fetch(`${THRESHOLD_ALERT_BASE}/check-now`, {
      method: "POST",
    })
  );
}
