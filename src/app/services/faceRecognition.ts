const FACE_API_BASE = "/api/face";

export interface FaceRegisterResponse {
  personId: string;
  personName: string;
  imagePath: string;
  message: string;
}

export interface FaceRecognizeResponse {
  matched: boolean;
  personId: string | null;
  personName: string | null;
  similarity: number;
  threshold: number;
}

export interface FaceRecordInfo {
  id: number;
  personId: string;
  personName: string;
  imagePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface FaceStatusResponse {
  modelReady: boolean;
  message: string;
}

export async function getFaceStatus(): Promise<FaceStatusResponse> {
  const res = await fetch(`${FACE_API_BASE}/status`);
  if (!res.ok) throw new Error("获取模型状态失败");
  return res.json();
}

export async function registerFace(
  image: Blob,
  personName: string,
  personId?: string
): Promise<FaceRegisterResponse> {
  const form = new FormData();
  form.append("image", image, "face.jpg");
  form.append("personName", personName);
  if (personId) form.append("personId", personId);

  const res = await fetch(`${FACE_API_BASE}/register`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "注册失败");
  }
  return res.json();
}

export async function recognizeFace(image: Blob): Promise<FaceRecognizeResponse> {
  const form = new FormData();
  form.append("image", image, "face.jpg");

  const res = await fetch(`${FACE_API_BASE}/recognize`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "识别失败");
  }
  return res.json();
}

export async function verifyFace(
  image: Blob,
  personId: string
): Promise<FaceRecognizeResponse> {
  const form = new FormData();
  form.append("image", image, "face.jpg");
  form.append("personId", personId);

  const res = await fetch(`${FACE_API_BASE}/verify`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "验证失败");
  }
  return res.json();
}

export async function listFaceRecords(): Promise<FaceRecordInfo[]> {
  const res = await fetch(`${FACE_API_BASE}/records`);
  if (!res.ok) throw new Error("查询失败");
  return res.json();
}

export async function deleteFaceRecord(personId: string): Promise<void> {
  const res = await fetch(`${FACE_API_BASE}/records/${encodeURIComponent(personId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("删除失败");
}
