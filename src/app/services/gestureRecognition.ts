/**
 * Gesture Recognition Service
 * Uses MediaPipe HandLandmarker for hand detection + rule-based classifier
 * matching the 13-class custom gesture model labels.
 *
 * Labels: one, two, three, four, five, six, seven, eight,
 *         fist, ok, thumbs_up, thumbs_down, none
 */
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type GestureLabel =
  | "one" | "two" | "three" | "four" | "five"
  | "six" | "seven" | "eight"
  | "fist" | "ok" | "thumbs_up" | "thumbs_down" | "none";

export interface GestureEvent {
  gesture: GestureLabel;
  timestamp: number;
}

type GestureCallback = (event: GestureEvent) => void;

// ── MediaPipe config ────────────────────────────────────────────────────────
// WASM 文件由 public/mediapipe/ 本地提供，避免 CDN 网络依赖
const WASM_BASE = "/mediapipe";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// ── Debounce config ─────────────────────────────────────────────────────────
/** Ms thumbs_up / thumbs_down must be held (deliberate mode-switch) */
const ACTIVATION_HOLD_MS = 1500;
/** Ms action gestures (fist, ok, numbers) must be held after Yaya is active */
const ACTION_HOLD_MS = 600;
/** Min ms between two emissions of the same gesture */
const SAME_GESTURE_COOLDOWN_MS = 1400;
/** Min ms between any two emissions */
const ANY_COOLDOWN_MS = 300;

// ── Module-level state (singleton) ──────────────────────────────────────────
let handLandmarker: HandLandmarker | null = null;
let rafId: number | null = null;
let videoEl: HTMLVideoElement | null = null;
let cameraStream: MediaStream | null = null;
let currentCallback: GestureCallback | null = null;

let pendingGesture: GestureLabel = "none";
let pendingStartTime = 0; // 当前手势首次出现的时间戳
let lastEmittedGesture: GestureLabel = "none";
let lastEmittedTime = 0;
let lastAnyTime = 0;

// ── Initialization ───────────────────────────────────────────────────────────
async function ensureInit(): Promise<void> {
  if (handLandmarker) return;
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

// ── Landmark-based gesture classifier ───────────────────────────────────────
function fingerUp(lm: NormalizedLandmark[], tip: number, pip: number): boolean {
  // Finger is "up" when tip is meaningfully above pip (lower Y = higher screen position)
  return lm[tip].y < lm[pip].y - 0.025;
}

/**
 * Rule-based gesture classification from 21 MediaPipe hand landmarks.
 *
 * Chinese number signs:
 *   1  index only
 *   2  index + middle
 *   3  index + middle + ring
 *   4  index + middle + ring + pinky (no thumb)
 *   5  all five
 *   6  thumb + pinky (phone sign ☎)
 *   7  thumb + index + middle (pistol/gun)
 *   8  thumb + index only (L-shape)
 */
function classifyFromLandmarks(
  lm: NormalizedLandmark[],
  handedness: string,
): GestureLabel {
  const isRight = handedness.toLowerCase().includes("right");

  const wrist    = lm[0];
  const thumbTip = lm[4];
  const thumbMcp = lm[2];
  const indexTip = lm[8];

  // Finger extension
  const idx = fingerUp(lm, 8,  6);   // index
  const mid = fingerUp(lm, 12, 10);  // middle
  const rng = fingerUp(lm, 16, 14);  // ring
  const pky = fingerUp(lm, 20, 18);  // pinky

  // Thumb extended horizontally away from palm
  const thumbExt = isRight
    ? thumbTip.x < thumbMcp.x - 0.045
    : thumbTip.x > thumbMcp.x + 0.045;

  // ── Fist territory (all 4 fingers curled) ────────────────────────────────
  if (!idx && !mid && !rng && !pky) {
    // lm[9] = 中指掌指关节，始终位于拳头关节行中心，
    // 随手型一起移动，拇指相对它的高低不受手型倒置影响
    const palmCenter = lm[9];
    const thumbUp   = thumbTip.y < palmCenter.y - 0.10; // 拇指尖远高于关节行
    const thumbDown = thumbTip.y > palmCenter.y + 0.10; // 拇指尖远低于关节行
    if (thumbUp)   return "thumbs_up";
    if (thumbDown) return "thumbs_down";
    return "fist";
  }

  // ── OK sign: thumb tip meets index tip, other 3 fingers up ───────────────
  if (mid && rng && pky) {
    const d = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    if (d < 0.09) return "ok";
  }

  // ── Number signs ─────────────────────────────────────────────────────────
  // 1 — index only, no thumb
  if (!thumbExt && idx && !mid && !rng && !pky) return "one";
  // 2 — index + middle, no thumb
  if (!thumbExt && idx && mid && !rng && !pky) return "two";
  // 3 — index + middle + ring, no thumb
  if (!thumbExt && idx && mid && rng && !pky) return "three";
  // 4 — four fingers up, no thumb
  if (!thumbExt && idx && mid && rng && pky) return "four";
  // 5 — all five
  if (thumbExt && idx && mid && rng && pky) return "five";
  // 6 — thumb + pinky (phone ☎)
  if (thumbExt && !idx && !mid && !rng && pky) return "six";
  // 7 — thumb + index + middle (gun/pistol)
  if (thumbExt && idx && mid && !rng && !pky) return "seven";
  // 8 — thumb + index only (L-shape)
  if (thumbExt && idx && !mid && !rng && !pky) return "eight";

  return "none";
}

// ── Detection loop ───────────────────────────────────────────────────────────
function processFrame(): void {
  if (!handLandmarker || !videoEl || videoEl.readyState < 2) {
    rafId = requestAnimationFrame(processFrame);
    return;
  }

  const now = performance.now();
  const result = handLandmarker.detectForVideo(videoEl, now);

  let detected: GestureLabel = "none";
  if (result.landmarks.length > 0 && result.handednesses.length > 0) {
    const lm          = result.landmarks[0];
    const handedness  = result.handednesses[0][0]?.categoryName ?? "Right";
    detected = classifyFromLandmarks(lm, handedness);
  }

  // Debounce: gesture must be held continuously for the required duration before emitting
  const isActivation = detected === "thumbs_up" || detected === "thumbs_down";
  const holdRequired = isActivation ? ACTIVATION_HOLD_MS : ACTION_HOLD_MS;

  if (detected !== "none" && detected === pendingGesture) {
    // 时间戳模式：手势须持续保持 holdRequired 才触发
    const heldMs = now - pendingStartTime;
    if (heldMs >= holdRequired) {
      const timeSinceLast = now - lastEmittedTime;
      const timeSinceAny  = now - lastAnyTime;
      const isSameAsLast  = detected === lastEmittedGesture;
      const cooldownOk    = !isSameAsLast
        ? timeSinceAny > ANY_COOLDOWN_MS
        : timeSinceLast > SAME_GESTURE_COOLDOWN_MS;

      if (cooldownOk) {
        lastEmittedGesture = detected;
        lastEmittedTime    = now;
        lastAnyTime        = now;
        pendingStartTime   = now; // 重置，下次需再持续 2 秒
        currentCallback?.({ gesture: detected, timestamp: now });
      }
    }
  } else {
    pendingGesture   = detected;
    pendingStartTime = detected !== "none" ? now : 0;
    if (detected === "none") {
      lastEmittedGesture = "none";
    }
  }

  rafId = requestAnimationFrame(processFrame);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Start gesture recognition.
 * Returns a cleanup function — call it to stop recognition and release camera.
 */
export async function startGestureRecognition(
  callback: GestureCallback,
): Promise<() => void> {
  // 已在运行时只更新 callback，不重启摄像头
  if (rafId !== null && videoEl !== null) {
    currentCallback = callback;
    return stopGestureRecognition;
  }

  currentCallback = callback;

  await ensureInit();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
    audio: false,
  });
  cameraStream = stream;

  const video = document.createElement("video");
  video.srcObject  = stream;
  video.playsInline = true;
  video.muted      = true;
  video.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(video);
  await video.play();
  videoEl = video;

  // Reset debounce state
  pendingGesture     = "none";
  pendingStartTime   = 0;
  lastEmittedGesture = "none";
  lastEmittedTime    = 0;
  lastAnyTime        = 0;

  rafId = requestAnimationFrame(processFrame);

  return stopGestureRecognition;
}

/** Human-readable error from a getUserMedia / MediaPipe failure. */
export function describeGestureError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "摄像头权限被拒绝，请在浏览器地址栏点击摄像头图标手动允许";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "未检测到摄像头设备，请确认设备已连接";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "摄像头被其他应用占用，请关闭后重试";
    }
  }
  if (err instanceof TypeError && String(err).includes("wasm")) {
    return "手势模型加载失败，请检查网络连接后重试";
  }
  return `手势识别启动失败：${err instanceof Error ? err.message : String(err)}`;
}

/** Stop gesture recognition and release all resources. */
export function stopGestureRecognition(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.remove();
    videoEl = null;
  }
  currentCallback    = null;
  pendingGesture     = "none";
  pendingStartTime   = 0;
  lastEmittedGesture = "none";
}
