"""BearPi-agri 害虫识别服务 (纯 onnxruntime 版，不依赖 torch / ultralytics)
- 上传图片 → ONNX 分类 → 返回 Top-1/Top-5
- /api/latest, /api/clear, /api/upload 供大屏轮询
"""
from __future__ import annotations

import csv
import json
import os
import time
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
from flask import Flask, jsonify, render_template, request, send_from_directory, url_for
from flask_cors import CORS
from PIL import Image
from werkzeug.utils import secure_filename

ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

LATEST_FILE = ROOT / "latest.json"

DEFAULT_MODEL_PATH = ROOT / "models" / "best.onnx"
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH)))
NAMES_PATH = ROOT / "models" / "names.json"

NAME_MAP_CSV = ROOT / "insect_names_en_zh.csv"

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"ONNX model not found: {MODEL_PATH}. Run `python export_onnx.py` first."
    )

# ── 加载 ONNX 模型 ──
session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
input_shape = session.get_inputs()[0].shape  # 形如 [1, 3, 224, 224]
IMG_SIZE = int(input_shape[2]) if isinstance(input_shape[2], int) else 224

# ── 加载类别名 (idx -> en name) ──
NAMES_MAP: dict[int, str] = {}
if NAMES_PATH.exists():
    try:
        raw = json.loads(NAMES_PATH.read_text(encoding="utf-8"))
        NAMES_MAP = {int(k): v for k, v in raw.items()}
    except Exception:
        NAMES_MAP = {}


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


def softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


def preprocess(img: Image.Image) -> np.ndarray:
    """Ultralytics YOLO 分类预处理：resize 短边到 IMG_SIZE → CenterCrop → /255。"""
    w, h = img.size
    scale = IMG_SIZE / min(w, h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    img_resized = img.resize((new_w, new_h), Image.BILINEAR)
    left = (new_w - IMG_SIZE) // 2
    top = (new_h - IMG_SIZE) // 2
    img_cropped = img_resized.crop((left, top, left + IMG_SIZE, top + IMG_SIZE))

    arr = np.asarray(img_cropped, dtype=np.float32) / 255.0  # HWC
    arr = arr.transpose(2, 0, 1)  # CHW
    arr = np.expand_dims(arr, 0)  # NCHW
    return arr.astype(np.float32)


def infer_from_pil(img: Image.Image) -> dict[str, Any]:
    arr = preprocess(img)
    out = session.run(None, {input_name: arr})[0][0]  # (num_classes,)
    if out.min() < 0 or out.max() > 1.0001:
        out = softmax(out)

    top5_idx = np.argsort(out)[::-1][:5]
    top1_idx = int(top5_idx[0])
    top1_conf = float(out[top1_idx])
    top1_name_en = NAMES_MAP.get(top1_idx, str(top1_idx))

    top5_rows = []
    for idx in top5_idx:
        idx_i = int(idx)
        score = float(out[idx_i])
        en_name = NAMES_MAP.get(idx_i, str(idx_i))
        top5_rows.append({
            "class_en": en_name,
            "class_zh": to_cn_name(en_name),
            "conf": score,
            "percent": score * 100.0,
        })

    return {
        "top1_name_en": top1_name_en,
        "top1_name_zh": to_cn_name(top1_name_en),
        "top1_conf": top1_conf,
        "top5_rows": top5_rows,
    }


# ── Flask App ──
app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


def save_latest(result: dict[str, Any], image_url: str | None = None) -> None:
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
        return render_template("index.html", has_result=False, error="未检测到上传文件。")

    file = request.files["image"]
    if file.filename == "":
        return render_template("index.html", has_result=False, error="请选择一张图片。")
    if not allowed_file(file.filename):
        return render_template("index.html", has_result=False, error="不支持的文件格式。")

    filename = secure_filename(file.filename)
    save_path = UPLOAD_DIR / filename
    file.save(save_path)

    img = Image.open(save_path).convert("RGB")
    infer = infer_from_pil(img)

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
        detector_model_path="None (ONNX classify only)",
    )


@app.route("/uploads/<path:filename>")
def uploaded_file(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


# ── Dashboard API ──
@app.route("/api/latest", methods=["GET"])
def api_latest():
    latest = load_latest()
    return jsonify({"ok": True, "data": latest})


@app.route("/api/clear", methods=["POST"])
def api_clear():
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
    print(f"[ready] ONNX model: {MODEL_PATH}  imgsz={IMG_SIZE}  classes={len(NAMES_MAP)}")
    app.run(host="0.0.0.0", port=5000, debug=False)

