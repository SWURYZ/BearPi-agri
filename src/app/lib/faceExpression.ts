/**
 * 人脸表情检测模块
 *
 * 使用 @vladmandic/face-api 库，模型从 jsDelivr CDN 远程下载，
 * 首次加载后浏览器自动缓存（不会重复下载）。
 *
 * 所需模型（约 500 KB 合计）：
 *   - tiny_face_detector  → 人脸定位（轻量级）
 *   - face_expression_net → 7 类表情分类
 */
import * as faceapi from "@vladmandic/face-api";

type FaceApiTfRuntime = {
  getBackend?: () => string;
  setBackend?: (backend: string) => Promise<boolean>;
  ready?: () => Promise<void>;
};

type FaceApiWithTf = typeof faceapi & {
  tf?: FaceApiTfRuntime;
};

/** 优先本地模型目录；若本地缺失再回退到 CDN。 */
const LOCAL_MODEL_URL = "/models/face-api";
const CDN_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model";

export type Expression =
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "fearful"
  | "disgusted"
  | "neutral";

export interface ExpressionResult {
  expression: Expression;
  confidence: number;
}

/** 每种表情的展示配置 */
export const EXPRESSION_CONFIG: Record<
  Expression,
  {
    emoji: string;
    accentColor: string;
    glowColor: string;
    rippleColor: string;
    badge: string;
    greeting: string;
    detail: string;
    speech: (name: string) => string;
  }
> = {
  happy: {
    emoji: "😊",
    accentColor: "#4ade80",
    glowColor: "rgba(74,222,128,0.35)",
    rippleColor: "rgba(74,222,128,0.4)",
    badge: "心情愉快",
    greeting: "今天看起来心情真好！",
    detail: "愿您的工作也同样顺心愉快",
    speech: (n) =>
      `${n}，您今天看起来心情很棒！祝工作愉快，智慧农业管理系统随时为您服务`,
  },
  sad: {
    emoji: "🌧️",
    accentColor: "#60a5fa",
    glowColor: "rgba(96,165,250,0.35)",
    rippleColor: "rgba(96,165,250,0.4)",
    badge: "辛苦了",
    greeting: "辛苦了，好好休息",
    detail: "系统随时待命，帮您减轻负担",
    speech: (n) =>
      `${n}，今天辛苦了。智慧农业系统会帮您高效管理生产，放心交给我们`,
  },
  angry: {
    emoji: "🌬️",
    accentColor: "#fb923c",
    glowColor: "rgba(251,146,60,0.35)",
    rippleColor: "rgba(251,146,60,0.4)",
    badge: "放松一下",
    greeting: "深呼吸，放松一下",
    detail: "一切都会好的，系统为您分忧",
    speech: (n) =>
      `${n}，放松一下，深呼吸。智慧农业系统帮您轻松管理，减少烦恼`,
  },
  surprised: {
    emoji: "✨",
    accentColor: "#a78bfa",
    glowColor: "rgba(167,139,250,0.35)",
    rippleColor: "rgba(167,139,250,0.4)",
    badge: "惊喜连连",
    greeting: "有什么新发现吗？",
    detail: "探索智慧农业的无限可能",
    speech: (n) =>
      `${n}，欢迎！今天有什么新发现吗？让我们一起探索智慧农业的精彩`,
  },
  fearful: {
    emoji: "🌿",
    accentColor: "#34d399",
    glowColor: "rgba(52,211,153,0.35)",
    rippleColor: "rgba(52,211,153,0.4)",
    badge: "一切正常",
    greeting: "别担心，一切都好",
    detail: "系统运行稳定，农场尽在掌控",
    speech: (n) =>
      `${n}，别担心，系统运行一切正常，农场生产尽在掌控，请放心使用`,
  },
  disgusted: {
    emoji: "💪",
    accentColor: "#fbbf24",
    glowColor: "rgba(251,191,36,0.35)",
    rippleColor: "rgba(251,191,36,0.4)",
    badge: "加油打气",
    greeting: "坚持就是胜利！",
    detail: "今天也要努力，创造价值",
    speech: (n) =>
      `${n}，坚持就是胜利！今天也要加油，智慧农业系统为您保驾护航`,
  },
  neutral: {
    emoji: "🎯",
    accentColor: "#4ade80",
    glowColor: "rgba(74,222,128,0.2)",
    rippleColor: "rgba(74,222,128,0.3)",
    badge: "专注高效",
    greeting: "专注高效，稳步前行",
    detail: "智慧农业管理系统准备就绪",
    speech: (n) => `${n}，欢迎您使用智慧农业管理系统`,
  },
};

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;
let backendReady = false;
let backendPromise: Promise<void> | null = null;

/**
 * 某些设备/驱动下 WebGL2 的 fenceSync 会为 null，导致 tfjs 在推理时崩溃。
 * 这里优先使用 CPU 后端保证稳定性。
 */
async function ensureTfBackendReady(): Promise<void> {
  if (backendReady) return;
  if (backendPromise) return backendPromise;

  backendPromise = (async () => {
    const runtime = faceapi as FaceApiWithTf;
    const tf = runtime.tf;

    if (!tf?.ready || !tf?.setBackend) {
      backendReady = true;
      return;
    }

    try {
      if (tf.getBackend?.() !== "cpu") {
        await tf.setBackend("cpu");
      }
      await tf.ready();
      backendReady = true;
    } catch (err) {
      backendPromise = null;
      throw err;
    }
  })();

  return backendPromise;
}

/**
 * 预加载表情识别所需的两个轻量模型。
 * 若本地模型已提前下载到 D 盘项目目录，会优先从本地加载。
 */
export async function loadExpressionModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  await ensureTfBackendReady();

  const loadFrom = async (modelUrl: string) => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceExpressionNet.loadFromUri(modelUrl),
    ]);
  };

  loadingPromise = (async () => {
    try {
      await loadFrom(LOCAL_MODEL_URL);
      modelsLoaded = true;
      return;
    } catch (localErr) {
      console.warn("[face-expression] 本地模型加载失败，回退 CDN", localErr);
    }

    try {
      await loadFrom(CDN_MODEL_URL);
      modelsLoaded = true;
    } catch (cdnErr) {
      console.error("[face-expression] CDN 模型加载失败", cdnErr);
      throw cdnErr;
    }
  })();

  try {
    await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

/**
 * 从已有的 canvas 或 video 元素检测主要表情。
 * 若检测不到人脸返回 null。
 */
export async function detectExpression(
  source: HTMLCanvasElement | HTMLVideoElement,
): Promise<ExpressionResult | null> {
  if (!modelsLoaded) await loadExpressionModels();

  const detection = await faceapi
    .detectSingleFace(
      source,
      new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }),
    )
    .withFaceExpressions();

  if (!detection) return null;

  const entries = Object.entries(detection.expressions) as [
    Expression,
    number,
  ][];
  const [expression, confidence] = entries.reduce((a, b) =>
    a[1] > b[1] ? a : b,
  );

  return { expression, confidence };
}

/**
 * 从摄像头拍摄单帧并检测表情（用于密码登录场景）。
 * 若摄像头不可用或检测失败返回 null，不抛异常。
 */
export async function detectExpressionFromCamera(): Promise<ExpressionResult | null> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
      audio: false,
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
      setTimeout(reject, 5000); // 5s 超时保护
    });

    // 等待画面稳定
    await new Promise((r) => setTimeout(r, 500));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await detectExpression(canvas);
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}
