# Insect Recognition (Shareable Folder)

This folder is a minimal but runnable insect recognition package.
It includes:

- Image upload classification using best.pt
- Realtime camera mode using YOLOv11 detection + best.pt classification

## 1) Folder layout

- app.py
- requirements.txt
- templates/index.html
- templates/realtime.html
- static/style.css
- models/best.pt
- models/yolo11s.pt
- insect_names_en_zh.csv (optional, for Chinese class names)

## 2) Setup

```bash
cd share_insect_recognition
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 3) Models

Default model paths:

- models/best.pt
- models/yolo11s.pt

You can override them with environment variables (use paths relative to this service directory, or absolute paths if needed):

```bash
# Windows (cmd)
set MODEL_PATH=models\best.pt
set DETECTOR_MODEL_PATH=models\yolo11s.pt

# Linux / macOS
export MODEL_PATH=models/best.pt
export DETECTOR_MODEL_PATH=models/yolo11s.pt
```

## 4) Run

```bash
python app.py
```

Open in browser:

- http://127.0.0.1:5000 (upload image)
- http://127.0.0.1:5000/realtime (camera realtime)

## Notes

- Supported image types: jpg, jpeg, png, bmp, webp, tif, tiff.
- Upload size limit is 10MB per image.
- If insect_names_en_zh.csv is missing, class names are shown in English only.
- If yolo11s.pt is missing, realtime mode falls back to full-frame classification.
