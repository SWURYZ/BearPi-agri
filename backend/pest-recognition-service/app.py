"""BearPi-agri 害虫识别服务 (纯 onnxruntime 版，不依赖 torch / ultralytics)
- 上传图片 → ONNX 分类 → 返回 Top-1/Top-5
- /api/latest, /api/clear, /api/upload 供大屏轮询
"""
from __future__ import annotations

import base64
import csv
import io
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
import onnxruntime as ort
from flask import Flask, jsonify, render_template, request, send_from_directory, url_for
from flask_cors import CORS
from PIL import Image, ImageOps
from werkzeug.utils import secure_filename

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass

ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ASSET_VERSION = int(time.time())

LATEST_FILE = ROOT / "latest.json"

DEFAULT_MODEL_PATH = ROOT / "models" / "best.onnx"
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH)))
NAMES_PATH = ROOT / "models" / "names.json"

NAME_MAP_CSV = ROOT / "insect_names_en_zh.csv"

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
ALLOWED_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/heic": ".heic",
    "image/heif": ".heif",
}
ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS | {".heic", ".heif"}

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


def to_farmer_cn_name(name: str, idx: int) -> str:
    zh = to_cn_name(name)
    if zh != name:
        return zh
    # 兜底：把 PascalCase 学名拆成空格分隔，便于阅读
    import re
    pretty = re.sub(r"(?<!^)(?=[A-Z])", " ", name).strip()
    return pretty or f"虫种{idx + 1:03d}"


def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def infer_extension(filename: str, mimetype: str | None = None) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext in ALLOWED_EXTENSIONS:
        return ext
    if mimetype:
        mapped = ALLOWED_MIME_TO_EXT.get(mimetype.lower())
        if mapped:
            return mapped
    return ""


def load_image_from_bytes(raw: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img)
    return img.convert("RGB")


def persist_upload(raw: bytes, ext: str, stem: str = "upload") -> str:
    safe_stem = secure_filename(stem) or "upload"
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    name = f"{safe_stem}_{ts}_{uuid4().hex[:8]}{ext}"
    (UPLOAD_DIR / name).write_bytes(raw)
    return name


def parse_request_image() -> tuple[str, Image.Image]:
    if "image" in request.files:
        file = request.files["image"]
        if not file.filename:
            raise ValueError("empty filename")
        ext = infer_extension(file.filename, file.mimetype)
        if not ext:
            raise ValueError("unsupported format")

        raw = file.read()
        if not raw:
            raise ValueError("empty payload")

        img = load_image_from_bytes(raw)
        saved = persist_upload(raw, ext, Path(file.filename).stem or "camera")
        return saved, img

    payload = request.get_json(silent=True) or {}
    data_url = payload.get("image", "")
    if not isinstance(data_url, str) or not data_url:
        raise ValueError("no image")

    if "," in data_url:
        header, b64 = data_url.split(",", 1)
        mime = header.split(";")[0].replace("data:", "").strip().lower()
        ext = ALLOWED_MIME_TO_EXT.get(mime, ".jpg")
        raw = base64.b64decode(b64)
    else:
        ext = ".jpg"
        raw = base64.b64decode(data_url)

    if not raw:
        raise ValueError("empty payload")

    img = load_image_from_bytes(raw)
    saved = persist_upload(raw, ext, "mobile")
    return saved, img


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
            "class_zh": to_farmer_cn_name(en_name, idx_i),
            "conf": score,
            "percent": score * 100.0,
        })

    return {
        "top1_name_en": top1_name_en,
        "top1_name_zh": to_farmer_cn_name(top1_name_en, top1_idx),
        "top1_conf": top1_conf,
        "top5_rows": top5_rows,
    }


# ── Flask App ──
app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024


@app.context_processor
def inject_asset_version():
    return {"ASSET_VERSION": ASSET_VERSION}


@app.after_request
def disable_html_cache(resp):
    if resp.content_type and "text/html" in resp.content_type:
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp


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

    try:
        filename, img = parse_request_image()
    except ValueError as e:
        msg = str(e)
        if msg == "unsupported format":
            return render_template("index.html", has_result=False, error="文件格式不支持，请上传 JPG/PNG/HEIC。")
        if msg in {"empty filename", "empty payload", "no image"}:
            return render_template("index.html", has_result=False, error="未检测到可识别图片，请重试。")
        return render_template("index.html", has_result=False, error="上传失败，请重试。")
    except Exception:
        return render_template("index.html", has_result=False, error="图片读取失败，请换一张清晰照片。")

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
    try:
        filename, img = parse_request_image()
    except ValueError as e:
        msg = str(e)
        if msg == "unsupported format":
            return jsonify({"ok": False, "error": "Unsupported format"}), 400
        if msg in {"empty filename", "empty payload", "no image"}:
            return jsonify({"ok": False, "error": "No image"}), 400
        return jsonify({"ok": False, "error": "Invalid image"}), 400
    except Exception:
        return jsonify({"ok": False, "error": "Decode failed"}), 400

    infer = infer_from_pil(img)
    image_url = url_for("uploaded_file", filename=filename, _external=True)
    save_latest(infer, image_url=image_url)
    return jsonify({"ok": True, "data": {**infer, "image_url": image_url}})


if __name__ == "__main__":
    print(f"[ready] ONNX model: {MODEL_PATH}  imgsz={IMG_SIZE}  classes={len(NAMES_MAP)}")
    app.run(host="0.0.0.0", port=5000, debug=False)

