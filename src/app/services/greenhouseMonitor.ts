const GREENHOUSE_MONITOR_BASE = "/api/v1/greenhouse-monitor";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface DeviceMappingResponse {
  id: number;
  deviceId: string;
  deviceName: string | null;
  deviceType: string | null;
  greenhouseCode: string;
  status: string;
  boundAt: string | null;
  unboundAt: string | null;
  updatedAt: string | null;
}

export interface DeviceScanBindRequest {
  qrContent: string;
  greenhouseCode?: string;
}

export async function fetchConnectedDevicesInDefaultGreenhouse(): Promise<DeviceMappingResponse[]> {
  const res = await fetch(`${GREENHOUSE_MONITOR_BASE}/greenhouses/default/devices/connected`);
  const json: ApiResponse<DeviceMappingResponse[]> = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `Load devices failed: ${res.status}`);
  }
  return json.data || [];
}

export async function fetchAllConnectedDevices(): Promise<DeviceMappingResponse[]> {
  const res = await fetch(`${GREENHOUSE_MONITOR_BASE}/devices/connected`);
  const json: ApiResponse<DeviceMappingResponse[]> = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `Load connected devices failed: ${res.status}`);
  }
  return json.data || [];
}

export async function scanBindDevice(req: DeviceScanBindRequest): Promise<DeviceMappingResponse> {
  const res = await fetch(`${GREENHOUSE_MONITOR_BASE}/devices/scan-bind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json: ApiResponse<DeviceMappingResponse> = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `Bind device failed: ${res.status}`);
  }
  return json.data;
}

export async function unbindDevice(deviceId: string): Promise<DeviceMappingResponse> {
  const res = await fetch(`${GREENHOUSE_MONITOR_BASE}/devices/${encodeURIComponent(deviceId)}/unbind`, {
    method: "POST",
  });
  const json: ApiResponse<DeviceMappingResponse> = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `Unbind failed: ${res.status}`);
  }
  return json.data;
}
