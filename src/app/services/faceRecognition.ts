<<<<<<< HEAD
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
=======
import { withApiBase } from "../lib/env";

/* ========== 类型 ========== */

export interface FaceRecognizeResponse {
  matched: boolean;
  personName: string;
  personId: string;
>>>>>>> 7cff49c3a5a4125c8d3e4397b73053a8d596060a
  similarity: number;
  threshold: number;
}

export interface FaceRecordInfo {
<<<<<<< HEAD
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
=======
  personId: string;
  personName: string;
  registeredAt?: string;
}

export interface FaceRegisterResponse {
  personId: string;
  personName: string;
  message: string;
}

/* ========== API 调用 ========== */
>>>>>>> 7cff49c3a5a4125c8d3e4397b73053a8d596060a

export async function registerFace(
  image: Blob,
  personName: string,
<<<<<<< HEAD
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
=======
  personId?: string,
): Promise<FaceRegisterResponse> {
  const fd = new FormData();
  fd.append("image", image, "face.jpg");
  fd.append("personName", personName);
  if (personId) fd.append("personId", personId);

  const res = await fetch(withApiBase("/api/face/register"), {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `注册失败: ${res.status}`);
>>>>>>> 7cff49c3a5a4125c8d3e4397b73053a8d596060a
  }
  return res.json();
}

export async function recognizeFace(image: Blob): Promise<FaceRecognizeResponse> {
<<<<<<< HEAD
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
=======
  const fd = new FormData();
  fd.append("image", image, "face.jpg");

  const res = await fetch(withApiBase("/api/face/recognize"), {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`识别请求失败: ${res.status}`);
>>>>>>> 7cff49c3a5a4125c8d3e4397b73053a8d596060a
  return res.json();
}

export async function listFaceRecords(): Promise<FaceRecordInfo[]> {
<<<<<<< HEAD
  const res = await fetch(`${FACE_API_BASE}/records`);
  if (!res.ok) throw new Error("查询失败");
=======
  const res = await fetch(withApiBase("/api/face/records"), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`获取记录失败: ${res.status}`);
>>>>>>> 7cff49c3a5a4125c8d3e4397b73053a8d596060a
  return res.json();
}

export async function deleteFaceRecord(personId: string): Promise<void> {
<<<<<<< HEAD
  const res = await fetch(`${FACE_API_BASE}/records/${encodeURIComponent(personId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("删除失败");
=======
  const res = await fetch(
    withApiBase(`/api/face/records/${encodeURIComponent(personId)}`),
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`删除失败: ${res.status}`);
>>>>>>> 7cff49c3a5a4125c8d3e4397b73053a8d596060a
}
