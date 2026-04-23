const COMPOSITE_BASE = "/api/v1/composite-condition";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface RuleConditionRequest {
  sensorMetric: string;
  sourceDeviceId: string;
  operator: "GT" | "GTE" | "LT" | "LTE" | "EQ" | "NEQ";
  threshold: number;
}

export interface CompositeRuleRequest {
  name: string;
  description?: string;
  logicOperator: "AND" | "OR";
  enabled: boolean;
  targetDeviceId: string;
  commandType: string;
  commandAction: string;
  conditions: RuleConditionRequest[];
}

export interface RuleConditionResponse {
  id: number;
  sensorMetric: string;
  sourceDeviceId: string;
  operator: string;
  threshold: number;
}

export interface CompositeRuleResponse {
  id: number;
  name: string;
  description?: string;
  logicOperator: "AND" | "OR";
  enabled: boolean;
  targetDeviceId: string;
  commandType: string;
  commandAction: string;
  conditions: RuleConditionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkageLogResponse {
  id: number;
  ruleId: number;
  ruleName: string;
  conditionSnapshot?: string;
  targetDeviceId: string;
  commandType: string;
  commandAction: string;
  dispatchStatus: string;
  cloudMessageId?: string;
  errorMessage?: string;
  triggeredAt: string;
}

export interface SensorDataRequest {
  deviceId: string;
  metric: string;
  value: number;
}

export async function fetchCompositeRules(): Promise<CompositeRuleResponse[]> {
  const res = await fetch(`${COMPOSITE_BASE}/rules`);
  const json: ApiResponse<CompositeRuleResponse[]> = await res.json();
  return json.data || [];
}

export async function createCompositeRule(req: CompositeRuleRequest): Promise<CompositeRuleResponse> {
  const res = await fetch(`${COMPOSITE_BASE}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json: ApiResponse<CompositeRuleResponse> = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `创建规则失败: ${res.status}`);
  }
  return json.data;
}

export async function updateCompositeRule(id: number, req: CompositeRuleRequest): Promise<CompositeRuleResponse> {
  const res = await fetch(`${COMPOSITE_BASE}/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json: ApiResponse<CompositeRuleResponse> = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `更新规则失败: ${res.status}`);
  }
  return json.data;
}

export async function toggleCompositeRule(id: number, enabled: boolean): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${COMPOSITE_BASE}/rules/${id}/enabled?value=${enabled}`, { method: "POST" });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "切换规则状态失败");
  }

  if (!res.ok) {
    // Backward compatibility for older deployments that only expose PATCH endpoint.
    const fallback = await fetch(`${COMPOSITE_BASE}/rules/${id}/enabled?value=${enabled}`, { method: "PATCH" });
    if (!fallback.ok) {
      throw new Error(`切换规则状态失败: ${fallback.status}`);
    }
  }
}

export async function deleteCompositeRule(id: number): Promise<void> {
  const res = await fetch(`${COMPOSITE_BASE}/rules/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`删除规则失败: ${res.status}`);
  }
}

export async function fetchRuleLogs(id: number): Promise<LinkageLogResponse[]> {
  const res = await fetch(`${COMPOSITE_BASE}/rules/${id}/logs`);
  const json: ApiResponse<LinkageLogResponse[]> = await res.json();
  return json.data || [];
}

export async function ingestSensorData(req: SensorDataRequest): Promise<void> {
  const res = await fetch(`${COMPOSITE_BASE}/sensor-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`上报传感器数据失败: ${res.status}`);
  }
}
