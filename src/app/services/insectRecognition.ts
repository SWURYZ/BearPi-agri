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
  /** 识别类型：害虫 / 植物病害；后端 latest.json 写入 */
  kind?: "insect" | "plant";
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

/**
 * 直接在 React 端上传图片做识别（移动端拍照入口）
 * 后端 Flask /api/upload 接受 multipart/form-data，字段名 image
 * 返回 ok=true 时 data 包含 top1_name_zh / top5_rows / image_url
 */
export interface InsectUploadResult {
  timestamp: number;
  top1_name_en: string;
  top1_name_zh: string;
  top1_conf: number;
  top5_rows: InsectTopRow[];
  image_url: string | null;
}

export async function uploadInsectImage(image: Blob): Promise<InsectUploadResult> {
  const form = new FormData();
  // 文件名后缀用 jpg；后端按 MIME 也能识别
  form.append("image", image, "capture.jpg");
  const res = await fetch(`${INSECT_BASE}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let msg = `上传失败 (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const json: ApiResponse<InsectUploadResult> = await res.json();
  if (!json.ok || !json.data) throw new Error(json.error || "识别失败");
  return json.data;
}

/**
 * 植物病害识别（PlantVillage 38 类）
 * Flask 端点 /api/plant/upload（Vite 代理 → :5000/api/plant/upload）
 * 返回格式与害虫识别完全一致，复用 InsectUploadResult。
 */
export async function uploadPlantImage(image: Blob): Promise<InsectUploadResult> {
  const form = new FormData();
  form.append("image", image, "plant.jpg");
  const res = await fetch(`/api/plant/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let msg = `上传失败 (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const json: ApiResponse<InsectUploadResult> = await res.json();
  if (!json.ok || !json.data) throw new Error(json.error || "识别失败");
  return json.data;
}

