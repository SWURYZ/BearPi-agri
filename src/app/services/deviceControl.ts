// 使用相对路径 + Vite 代理,避免手机访问时 localhost 指向手机本地导致失败
const DEVICE_CONTROL_BASE = "/api/v1/device-control";
const LIGHT_SCHEDULE_BASE = "/api/v1/light-schedule";
const IOT_ACCESS_BASE = "/api/v1/iot";

/* ==================== 业务三：设备远程手动控制 ==================== */

export interface ManualControlRequest {
  deviceId: string;
  commandType: string;
  action: string;
}

export interface ManualControlResponse {
  requestId: string;
  cloudMessageId: string | null;
  status: string;
  message: string;
}

export interface DeviceStatusResponse {
  deviceId: string;
  ledStatus: string;
  motorStatus: string;
  lastUpdated: string | null;
}

export interface RealtimeDeviceStatus {
  deviceId: string;
  reportTime: string | null;
  led: string | null;
  motor: string | null;
  temperature: number | null;
  humidity: number | null;
  luminance: number | null;
}

export interface ControlCommand {
  id: number;
  deviceId: string;
  requestId: string;
  cloudMessageId: string | null;
  commandType: string;
  commandPayload: string;
  status: string;
  resultCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export async function sendManualControl(req: ManualControlRequest): Promise<ManualControlResponse> {
  const res = await fetch(`${DEVICE_CONTROL_BASE}/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json: ApiResponse<ManualControlResponse> = await res.json();
  return json.data;
}

export async function fetchDeviceStatus(deviceId: string): Promise<DeviceStatusResponse> {
  const res = await fetch(`${DEVICE_CONTROL_BASE}/devices/${encodeURIComponent(deviceId)}/status`);
  const json: ApiResponse<DeviceStatusResponse> = await res.json();
  return json.data;
}

export async function fetchRealtimeDeviceStatus(deviceId: string): Promise<RealtimeDeviceStatus> {
  const res = await fetch(`${IOT_ACCESS_BASE}/devices/${encodeURIComponent(deviceId)}/status`);
  const json: ApiResponse<RealtimeDeviceStatus> = await res.json();
  return json.data;
}

export async function fetchCommandHistory(deviceId: string): Promise<ControlCommand[]> {
  const res = await fetch(`${DEVICE_CONTROL_BASE}/devices/${encodeURIComponent(deviceId)}/commands`);
  const json: ApiResponse<ControlCommand[]> = await res.json();
  return json.data;
}

/* ==================== 业务四：补光灯定时控制 ==================== */

export interface ScheduleRuleRequest {
  deviceId: string;
  ruleName: string;
  turnOnTime: string;
  turnOffTime: string;
  repeatMode?: string;
  commandType?: string;
  enabled?: boolean;
}

export interface ScheduleRuleResponse {
  id: number;
  deviceId: string;
  ruleName: string;
  turnOnTime: string;
  turnOffTime: string;
  enabled: boolean;
  repeatMode: string;
  commandType: string;
  createdAt: string;
}

export interface ScheduleExecutionLog {
  id: number;
  ruleId: number;
  deviceId: string;
  action: string;
  status: string;
  cloudMessageId: string | null;
  errorMessage: string | null;
  executedAt: string;
}

export async function fetchScheduleRules(): Promise<ScheduleRuleResponse[]> {
  const res = await fetch(`${LIGHT_SCHEDULE_BASE}/rules`);
  const json: ApiResponse<ScheduleRuleResponse[]> = await res.json();
  return json.data;
}

export async function createScheduleRule(req: ScheduleRuleRequest): Promise<ScheduleRuleResponse> {
  const res = await fetch(`${LIGHT_SCHEDULE_BASE}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json: ApiResponse<ScheduleRuleResponse> = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message || "创建失败");
  }
  return json.data;
}

export async function updateScheduleRule(id: number, req: ScheduleRuleRequest): Promise<ScheduleRuleResponse> {
  const res = await fetch(`${LIGHT_SCHEDULE_BASE}/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json: ApiResponse<ScheduleRuleResponse> = await res.json();
  return json.data;
}

export async function toggleScheduleRule(id: number, enabled: boolean): Promise<void> {
  await fetch(`${LIGHT_SCHEDULE_BASE}/rules/${id}/toggle?enabled=${enabled}`, {
    method: "PATCH",
  });
}

export async function deleteScheduleRule(id: number): Promise<void> {
  const res = await fetch(`${LIGHT_SCHEDULE_BASE}/rules/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Delete failed: ${res.status}`);
  }
}

export async function fetchExecutionLogs(ruleId: number): Promise<ScheduleExecutionLog[]> {
  const res = await fetch(`${LIGHT_SCHEDULE_BASE}/rules/${ruleId}/logs`);
  const json: ApiResponse<ScheduleExecutionLog[]> = await res.json();
  return json.data;
}
