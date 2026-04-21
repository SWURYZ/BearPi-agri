from __future__ import annotations

import base64
import csv
import io
import json
import os
import time
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request, send_from_directory, url_for
from flask_cors import CORS
from PIL import Image
from ultralytics import YOLO
from werkzeug.utils import secure_filename

ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Latest recognition result snapshot (consumed by BearPi-agri Dashboard)
LATEST_FILE = ROOT / "latest.json"

# Put your weight file at backend/pest-recognition-service/models/best.pt
DEFAULT_MODEL_PATH = ROOT / "models" / "best.pt"
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH)))

# YOLOv11 detector for realtime mode.
DEFAULT_DETECTOR_PATH = ROOT / "models" / "yolo11s.pt"
DETECTOR_MODEL_PATH = Path(os.getenv("DETECTOR_MODEL_PATH", str(DEFAULT_DETECTOR_PATH)))

# Optional: Chinese name mapping CSV with columns: English, 中文
NAME_MAP_CSV = ROOT / "insect_names_en_zh.csv"

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"
}

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found: {MODEL_PATH}. Place your best.pt at models/best.pt or set MODEL_PATH env."
    )

model = YOLO(str(MODEL_PATH))

detector_model: YOLO | None = None
active_detector_path = "None"
if DETECTOR_MODEL_PATH.exists():
    try:
        detector_model = YOLO(str(DETECTOR_MODEL_PATH))
        if getattr(detector_model, "task", "") != "detect":
            detector_model = None
        else:
            active_detector_path = str(DETECTOR_MODEL_PATH)
    except Exception:
        detector_model = None


def load_name_map(csv_path: Path) -> dict[str, str]:
    if not csv_path.exists():
        return {}

    mapping: dict[str, str] = {}
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                en = (row.get("English") or "").strip()
                zh = (row.get("中文") or "").strip()
                if en and zh:
                    mapping[en.lower()] = zh
    except Exception:
        return {}
    return mapping


NAME_MAP = load_name_map(NAME_MAP_CSV)


def to_cn_name(name: str) -> str:
    return NAME_MAP.get(name.lower(), name)


def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def format_topk(prob_obj: Any, names_map: dict[int, str], k: int = 5) -> list[dict[str, Any]]:
    indices = [int(i) for i in prob_obj.top5[:k]]
    scores = [float(s) for s in prob_obj.top5conf[:k]]
    rows: list[dict[str, Any]] = []
    for idx, score in zip(indices, scores):
        en_name = names_map.get(idx, str(idx))
        rows.append(
            {
                "class_en": en_name,
                "class_zh": to_cn_name(en_name),
                "conf": score,
                "percent": score * 100.0,
            }
        )
    return rows


def infer_from_pil(img: Image.Image) -> dict[str, Any]:
    result = model.predict(source=img, imgsz=224, verbose=False)[0]
    probs = result.probs
    top1_idx = int(probs.top1)
    top1_conf = float(probs.top1conf)
    names_map = {int(k): v for k, v in model.names.items()} if isinstance(model.names, dict) else {}
    top1_name = names_map.get(top1_idx, str(top1_idx))

    return {
        "top1_name_en": top1_name,
        "top1_name_zh": to_cn_name(top1_name),
        "top1_conf": top1_conf,
        "top5_rows": format_topk(probs, names_map, k=5),
    }


def crop_with_margin(img: Image.Image, box: dict[str, Any], margin_ratio: float = 0.12) -> Image.Image:
    w, h = img.size
    x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
    bw = x2 - x1
    bh = y2 - y1
    mx = bw * margin_ratio
    my = bh * margin_ratio

    lx = max(0, int(x1 - mx))
    ty = max(0, int(y1 - my))
    rx = min(w, int(x2 + mx))
    by = min(h, int(y2 + my))
    return img.crop((lx, ty, rx, by))


def normalize_box(box: dict[str, float], w: int, h: int) -> dict[str, float]:
    return {
        "x": max(0.0, min(1.0, box["x1"] / w)),
        "y": max(0.0, min(1.0, box["y1"] / h)),
        "w": max(0.0, min(1.0, (box["x2"] - box["x1"]) / w)),
        "h": max(0.0, min(1.0, (box["y2"] - box["y1"]) / h)),
    }


def infer_realtime_targets(img: Image.Image) -> list[dict[str, Any]]:
    w, h = img.size

    # Fallback: if YOLOv11 detector is unavailable, classify full frame.
    if detector_model is None:
        infer = infer_from_pil(img)
        return [
            {
                "name_en": infer["top1_name_en"],
                "name_zh": infer["top1_name_zh"],
                "conf": infer["top1_conf"],
                "display_label": infer["top1_name_zh"],
                "box": {"x": 0.08, "y": 0.08, "w": 0.84, "h": 0.84},
                "top5_rows": infer["top5_rows"],
            }
        ]

    detections: list[dict[str, Any]] = []
    try:
        det = detector_model.predict(source=img, imgsz=640, conf=0.25, verbose=False)[0]
        boxes = det.boxes
        if boxes is not None:
            for i in range(len(boxes)):
                b = boxes[i]
                conf = float(b.conf.item()) if b.conf is not None else 0.0
                x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
                raw_box = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}

                crop = crop_with_margin(img, raw_box)
                infer = infer_from_pil(crop)

                detections.append(
                    {
                        "name_en": infer["top1_name_en"],
                        "name_zh": infer["top1_name_zh"],
                        "conf": infer["top1_conf"],
                        "display_label": infer["top1_name_zh"],
                        "box": normalize_box(raw_box, w, h),
                        "top5_rows": infer["top5_rows"],
                    }
                )
    except Exception:
        detections = []

    if detections:
        return detections

    infer = infer_from_pil(img)
    return [
        {
            "name_en": infer["top1_name_en"],
            "name_zh": infer["top1_name_zh"],
            "conf": infer["top1_conf"],
            "display_label": infer["top1_name_zh"],
            "box": {"x": 0.08, "y": 0.08, "w": 0.84, "h": 0.84},
            "top5_rows": infer["top5_rows"],
        }
    ]


app = Flask(__name__)
CORS(app)  # allow BearPi-agri Dashboard (other port) to call /api/*
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


# ────────── latest result helpers ──────────

def save_latest(result: dict[str, Any], image_url: str | None = None) -> None:
    """Persist the latest recognition result so the BearPi-agri Dashboard can poll it."""
    payload = {
        "timestamp": int(time.time() * 1000),
        "top1_name_en": result.get("top1_name_en", ""),
        "top1_name_zh": result.get("top1_name_zh", ""),
        "top1_conf": result.get("top1_conf", 0.0),
        "top5_rows": result.get("top5_rows", []),
        "image_url": image_url,
        "consumed": False,
    }
    try:
        LATEST_FILE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def load_latest() -> dict[str, Any] | None:
    if not LATEST_FILE.exists():
        return None
    try:
        return json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "GET":
        return render_template("index.html", has_result=False)

    if "image" not in request.files:
        return render_template("index.html", has_result=False, error="No uploaded file detected.")

    file = request.files["image"]
    if file.filename == "":
        return render_template("index.html", has_result=False, error="Please choose an image.")

    if not allowed_file(file.filename):
        return render_template("index.html", has_result=False, error="Unsupported file format.")

    filename = secure_filename(file.filename)
    save_path = UPLOAD_DIR / filename
    file.save(save_path)

    img = Image.open(save_path).convert("RGB")
    infer = infer_from_pil(img)

    # Push the latest result to BearPi-agri Dashboard (background snapshot)
    image_url = url_for("uploaded_file", filename=filename, _external=True)
    save_latest(infer, image_url=image_url)

    return render_template(
        "index.html",
        has_result=True,
        image_path=url_for("uploaded_file", filename=filename),
        top1_name_en=infer["top1_name_en"],
        top1_name_zh=infer["top1_name_zh"],
        top1_conf=infer["top1_conf"],
        top5_rows=infer["top5_rows"],
        model_path=str(MODEL_PATH),
        detector_model_path=active_detector_path,
    )


@app.route("/realtime", methods=["GET"])
def realtime_page():
    return render_template(
        "realtime.html",
        model_path=str(MODEL_PATH),
        detector_model_path=active_detector_path,
    )


@app.route("/api/realtime_predict", methods=["POST"])
def realtime_predict():
    payload = request.get_json(silent=True) or {}
    data_url = payload.get("image", "")
    if not data_url or "," not in data_url:
        return jsonify({"ok": False, "error": "Invalid image payload."}), 400

    try:
        _, b64_data = data_url.split(",", 1)
        raw = base64.b64decode(b64_data)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        return jsonify({"ok": False, "error": "Image decode failed."}), 400

    detections = infer_realtime_targets(img)
    top1 = max(detections, key=lambda d: float(d.get("conf", 0.0))) if detections else None
    if top1 is None:
        return jsonify({"ok": False, "error": "No prediction."}), 500

    return jsonify(
        {
            "ok": True,
            "top1_name": top1.get("name_zh", "-"),
            "top1_conf": float(top1.get("conf", 0.0)),
            "top5_rows": top1.get("top5_rows", []),
            "detections": detections,
            "detector_model_path": active_detector_path,
        }
    )


@app.route("/uploads/<path:filename>")
def uploaded_file(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


# ────────────── BearPi-agri Dashboard API ──────────────

@app.route("/api/latest", methods=["GET"])
def api_latest():
    """Return the latest recognition result (used by Dashboard polling)."""
    latest = load_latest()
    if latest is None:
        return jsonify({"ok": True, "data": None})
    return jsonify({"ok": True, "data": latest})


@app.route("/api/clear", methods=["POST"])
def api_clear():
    """Mark the latest result as consumed so Dashboard won't trigger again."""
    latest = load_latest()
    if latest is not None:
        latest["consumed"] = True
        try:
            LATEST_FILE.write_text(json.dumps(latest, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass
    return jsonify({"ok": True})


@app.route("/api/upload", methods=["POST"])
def api_upload():
    """JSON API for mobile/programmatic upload. Returns recognition result."""
    if "image" not in request.files:
        return jsonify({"ok": False, "error": "No image"}), 400
    file = request.files["image"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"ok": False, "error": "Invalid image"}), 400

    filename = secure_filename(file.filename)
    save_path = UPLOAD_DIR / filename
    file.save(save_path)
    img = Image.open(save_path).convert("RGB")
    infer = infer_from_pil(img)
    image_url = url_for("uploaded_file", filename=filename, _external=True)
    save_latest(infer, image_url=image_url)
    return jsonify({"ok": True, "data": {**infer, "image_url": image_url}})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
