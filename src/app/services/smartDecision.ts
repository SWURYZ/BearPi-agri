const SMART_DECISION_BASE = "/api/v1/smart-decision";

export interface DecisionRequest {
  query: string;
  deviceId?: string;
  greenhouseCode?: string;
  scenario?: string;
  userId?: string;
}

export interface SensorSnapshot {
  temperature: number | null;
  humidity: number | null;
  luminance: number | null;
  ledStatus: string | null;
  motorStatus: string | null;
  reportTime: string | null;
}

export interface DecisionResponse {
  scenario: string;
  scenarioLabel: string;
  decision: string;
  sensorSnapshot: SensorSnapshot;
  graphTrace: string;
}

export interface ScenarioItem {
  code: string;
  label: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export async function executeDecision(req: DecisionRequest): Promise<DecisionResponse> {
  const res = await fetch(`${SMART_DECISION_BASE}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`决策请求失败: ${res.status}`);
  const json: ApiResponse<DecisionResponse> = await res.json();
  if (json.code !== 0) throw new Error(json.message || "决策服务异常");
  return json.data;
}

export async function getScenarios(): Promise<ScenarioItem[]> {
  const res = await fetch(`${SMART_DECISION_BASE}/scenarios`);
  if (!res.ok) throw new Error(`获取场景列表失败: ${res.status}`);
  const json: ApiResponse<ScenarioItem[]> = await res.json();
  if (json.code !== 0) throw new Error(json.message || "获取场景失败");
  return json.data;
}
