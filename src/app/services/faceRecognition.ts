import { withApiBase } from "../lib/env";

/* ========== 类型 ========== */

export interface FaceRecognizeResponse {
  matched: boolean;
  personName: string;
  personId: string;
  similarity: number;
  threshold: number;
}

export interface FaceRecordInfo {
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

export async function registerFace(
  image: Blob,
  personName: string,
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
  }
  return res.json();
}

export async function recognizeFace(image: Blob): Promise<FaceRecognizeResponse> {
  const fd = new FormData();
  fd.append("image", image, "face.jpg");

  const res = await fetch(withApiBase("/api/face/recognize"), {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`识别请求失败: ${res.status}`);
  return res.json();
}

export async function listFaceRecords(): Promise<FaceRecordInfo[]> {
  const res = await fetch(withApiBase("/api/face/records"), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`获取记录失败: ${res.status}`);
  return res.json();
}

export async function deleteFaceRecord(personId: string): Promise<void> {
  const res = await fetch(
    withApiBase(`/api/face/records/${encodeURIComponent(personId)}`),
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`删除失败: ${res.status}`);
}
