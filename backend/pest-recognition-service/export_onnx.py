"""一次性脚本：把 best.pt 导出为 best.onnx，并把类别名写到 names.json。
执行完成后即可卸载 torch / ultralytics，运行时只用 onnxruntime。

用法：
    cd backend/pest-recognition-service
    python export_onnx.py
"""
import json
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "best.pt"
ONNX_PATH = ROOT / "models" / "best.onnx"
NAMES_PATH = ROOT / "models" / "names.json"

print(f"[load] {MODEL_PATH}")
model = YOLO(str(MODEL_PATH))

# 导出 ONNX（分类模型默认 imgsz=224）
print("[export] -> ONNX (imgsz=224, opset=12, simplify=True)")
exported = model.export(format="onnx", imgsz=224, opset=12, simplify=True, dynamic=False)
print(f"[done] exported = {exported}")

# 把 ultralytics 默认导出的 .onnx 移动/重命名到 best.onnx
exported_path = Path(exported)
if exported_path.exists() and exported_path != ONNX_PATH:
    if ONNX_PATH.exists():
        ONNX_PATH.unlink()
    exported_path.rename(ONNX_PATH)

# 保存类别名映射 {idx: name}
names_map = {int(k): v for k, v in model.names.items()} if isinstance(model.names, dict) else {}
NAMES_PATH.write_text(json.dumps(names_map, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"[done] names -> {NAMES_PATH}  ({len(names_map)} classes)")
print(f"[done] onnx  -> {ONNX_PATH}")
