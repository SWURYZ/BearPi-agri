/**
 * 害虫识别服务客户端
 *
 * 流程：
 * 1. 手机扫码访问 http://[局域网IP]:5000，拍照上传
 * 2. Flask 后端 YOLO 推理，结果写入 latest.json
 * 3. Dashboard 轮询 /api/insect/latest（Vite 代理 → Flask /api/latest）
 * 4. 拿到害虫名 → 调用精灵芽芽 streamAgriAgentChat 获取防治方案
 */

const INSECT_BASE = "/api/insect";

export interface InsectTopRow {
  class_en: string;
  class_zh: string;
  conf: number;
  percent: number;
}

export interface InsectLatestResult {
  timestamp: number;
  top1_name_en: string;
  top1_name_zh: string;
  top1_conf: number;
  top5_rows: InsectTopRow[];
  image_url: string | null;
  consumed: boolean;
}

interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error?: string;
}

export async function fetchLatestInsectResult(): Promise<InsectLatestResult | null> {
  try {
    const res = await fetch(`${INSECT_BASE}/latest`, { cache: "no-store" });
    if (!res.ok) return null;
    const json: ApiResponse<InsectLatestResult> = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function clearLatestInsectResult(): Promise<void> {
  try {
    await fetch(`${INSECT_BASE}/clear`, { method: "POST" });
  } catch {
    // ignore
  }
}
