"""
植物病虫害识别系统
基于 MobileNetV2 模型 (google/mobilenet_v2_1.0_224 微调)
支持 38 类植物病害识别，并提供 PyTorch → ONNX 转换功能
"""

import os
import sys
import json
import argparse
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
import onnx

# ──────────────────────────────────────────────
# 常量
# ──────────────────────────────────────────────
MODEL_DIR  = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(MODEL_DIR, "config.json")
BIN_PATH    = os.path.join(MODEL_DIR, "pytorch_model.bin")
ONNX_PATH   = os.path.join(MODEL_DIR, "plant_disease.onnx")
IMAGE_SIZE  = 224

# ImageNet 均值 / 标准差（与 HuggingFace MobileNetV2 预处理一致）
MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]


# ──────────────────────────────────────────────
# 加载标签映射
# ──────────────────────────────────────────────
def load_labels(config_path: str) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    return {int(k): v for k, v in cfg["id2label"].items()}


# ──────────────────────────────────────────────
# 图像预处理
# ──────────────────────────────────────────────
def preprocess(image_path: str) -> torch.Tensor:
    """将图像文件转换为模型输入张量 (1, 3, 224, 224)"""
    img = Image.open(image_path).convert("RGB")
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0          # [0,1]
    arr = (arr - np.array(MEAN)) / np.array(STD)           # 标准化
    arr = arr.transpose(2, 0, 1)                            # HWC → CHW
    return torch.from_numpy(arr).unsqueeze(0)               # (1,3,H,W)


def preprocess_numpy(image_path: str) -> np.ndarray:
    """返回 numpy 数组，供 ONNX 推理使用"""
    return preprocess(image_path).numpy()


# ──────────────────────────────────────────────
# 加载 PyTorch 模型
# ──────────────────────────────────────────────
def load_pytorch_model(num_labels: int = 38) -> nn.Module:
    """
    使用 HuggingFace transformers 加载 MobileNetV2ForImageClassification。
    从本地 config.json + pytorch_model.bin 读取，无需网络。
    """
    try:
        from transformers import MobileNetV2ForImageClassification, MobileNetV2Config
    except ImportError:
        sys.exit("[错误] 请先安装 transformers: pip install transformers")

    cfg = MobileNetV2Config.from_pretrained(MODEL_DIR)
    model = MobileNetV2ForImageClassification(cfg)
    state_dict = torch.load(BIN_PATH, map_location="cpu", weights_only=True)
    # detect weight dtype from the first floating-point parameter
    weight_dtype = next(
        (v.dtype for v in state_dict.values() if v.is_floating_point()), torch.float32
    )
    model.load_state_dict(state_dict)
    # cast model to match weight dtype, then convert to float32 for inference
    if weight_dtype == torch.float64:
        model = model.double()
    else:
        model = model.float()
    model.eval()
    print(f"[✓] PyTorch 模型加载成功，参数量: {sum(p.numel() for p in model.parameters()):,}")
    return model


# ──────────────────────────────────────────────
# PyTorch 推理
# ──────────────────────────────────────────────
def predict_pytorch(model: nn.Module, image_path: str, id2label: dict) -> dict:
    tensor = preprocess(image_path)
    # match tensor dtype to model weights
    model_dtype = next(model.parameters()).dtype
    tensor = tensor.to(model_dtype)
    with torch.no_grad():
        outputs = model(pixel_values=tensor)
        logits  = outputs.logits                        # (1, num_labels)
    probs      = torch.softmax(logits, dim=-1)[0]
    pred_id    = int(probs.argmax())
    confidence = float(probs[pred_id])
    label      = id2label[pred_id]

    # Top-5
    top5 = torch.topk(probs, k=min(5, len(id2label)))
    top5_results = [
        {"id": int(i), "label": id2label[int(i)], "confidence": float(p)}
        for i, p in zip(top5.indices, top5.values)
    ]
    return {
        "image":      image_path,
        "pred_id":    pred_id,
        "label":      label,
        "confidence": confidence,
        "top5":       top5_results,
    }


# ──────────────────────────────────────────────
# 导出 ONNX
# ──────────────────────────────────────────────
def export_onnx(model: nn.Module, onnx_path: str = ONNX_PATH) -> str:
    dummy_input = torch.zeros(1, 3, IMAGE_SIZE, IMAGE_SIZE)

    # HuggingFace 模型的 forward 接受 pixel_values 关键字参数
    # 用 wrapper 让 torch.onnx.export 可以正确追踪
    class ModelWrapper(nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m.float()  # ONNX export uses float32
        def forward(self, x):
            return self.m(pixel_values=x).logits

    wrapped = ModelWrapper(model)
    wrapped.eval()
    dummy_input = dummy_input.float()

    torch.onnx.export(
        wrapped,
        dummy_input,
        onnx_path,
        opset_version=17,
        input_names=["pixel_values"],
        output_names=["logits"],
        dynamic_axes={
            "pixel_values": {0: "batch_size"},
            "logits":       {0: "batch_size"},
        },
        verbose=False,
    )

    # 验证 ONNX 模型结构
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    size_mb = os.path.getsize(onnx_path) / 1024 / 1024
    print(f"[✓] ONNX 模型已保存: {onnx_path}  ({size_mb:.1f} MB)")
    return onnx_path


# ──────────────────────────────────────────────
# ONNX 推理（验证）
# ──────────────────────────────────────────────
def predict_onnx(onnx_path: str, image_path: str, id2label: dict) -> dict:
    try:
        import onnxruntime as ort
    except ImportError as e:
        sys.exit(f"[错误] 无法加载 onnxruntime: {e}")

    session  = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    inp_name = session.get_inputs()[0].name
    arr      = preprocess_numpy(image_path)
    logits   = session.run(None, {inp_name: arr})[0][0]   # (num_labels,)
    exp      = np.exp(logits - logits.max())
    probs    = exp / exp.sum()
    pred_id  = int(probs.argmax())
    label    = id2label[pred_id]
    confidence = float(probs[pred_id])

    top5_ids = probs.argsort()[::-1][:5]
    top5_results = [
        {"id": int(i), "label": id2label[int(i)], "confidence": float(probs[i])}
        for i in top5_ids
    ]
    return {
        "image":      image_path,
        "pred_id":    pred_id,
        "label":      label,
        "confidence": confidence,
        "top5":       top5_results,
    }


# ──────────────────────────────────────────────
# 打印结果
# ──────────────────────────────────────────────
def print_result(result: dict, backend: str = "PyTorch"):
    print(f"\n{'='*55}")
    print(f"  推理后端 : {backend}")
    print(f"  图像路径 : {result['image']}")
    print(f"  识别结果 : {result['label']}")
    print(f"  置信度   : {result['confidence']*100:.2f}%")
    print(f"  Top-5 预测:")
    for i, r in enumerate(result["top5"], 1):
        print(f"    {i}. {r['label']:<50} {r['confidence']*100:.2f}%")
    print(f"{'='*55}\n")


# ──────────────────────────────────────────────
# 测试（无真实图像时使用随机噪声图）
# ──────────────────────────────────────────────
def run_test(model: nn.Module, id2label: dict):
    """使用随机生成的测试图像进行功能验证"""
    test_img_path = os.path.join(MODEL_DIR, "_test_image.png")
    # 生成一张随机 RGB 图像
    rng = np.random.default_rng(42)
    fake = (rng.random((IMAGE_SIZE, IMAGE_SIZE, 3)) * 255).astype(np.uint8)
    Image.fromarray(fake).save(test_img_path)
    print(f"[i] 生成测试图像: {test_img_path}")

    # PyTorch 推理
    result_pt = predict_pytorch(model, test_img_path, id2label)
    print_result(result_pt, backend="PyTorch")

    # ONNX 推理（仅在 ONNX 文件存在时执行）
    if os.path.exists(ONNX_PATH):
        try:
            result_onnx = predict_onnx(ONNX_PATH, test_img_path, id2label)
            print_result(result_onnx, backend="ONNX Runtime")

            # 比较两个后端的输出一致性
            if result_pt["pred_id"] == result_onnx["pred_id"]:
                print("[✓] PyTorch 与 ONNX 输出一致，转换验证通过！")
            else:
                print("[!] 警告: PyTorch 与 ONNX 输出不一致，请检查转换过程。")
        except SystemExit as e:
            print(f"[!] 跳过 ONNX 推理验证: {e}")

    # 清理临时文件
    os.remove(test_img_path)


# ──────────────────────────────────────────────
# 主程序
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="植物病虫害识别 (MobileNetV2)")
    parser.add_argument("--image",   type=str, default=None, help="待识别图像路径")
    parser.add_argument("--export",  action="store_true",    help="将模型导出为 ONNX")
    parser.add_argument("--test",    action="store_true",    help="运行功能测试")
    parser.add_argument("--backend", choices=["pytorch", "onnx"], default="pytorch",
                        help="推理后端 (默认 pytorch)")
    args = parser.parse_args()

    id2label = load_labels(CONFIG_PATH)
    print(f"[✓] 标签加载完成，共 {len(id2label)} 类")

    # 加载 PyTorch 模型（导出或 pytorch 推理时需要）
    need_pytorch = args.export or args.test or (args.backend == "pytorch") or (args.image is not None and args.backend == "pytorch")
    model = None
    if need_pytorch or (args.image and args.backend == "pytorch"):
        model = load_pytorch_model(num_labels=len(id2label))

    # 导出 ONNX
    if args.export:
        export_onnx(model)

    # 运行测试
    if args.test:
        if model is None:
            model = load_pytorch_model(num_labels=len(id2label))
        # 先确保 ONNX 存在（测试时自动导出）
        if not os.path.exists(ONNX_PATH):
            print("[i] ONNX 模型不存在，自动导出...")
            export_onnx(model)
        run_test(model, id2label)

    # 单张图像推理
    if args.image:
        if not os.path.exists(args.image):
            sys.exit(f"[错误] 图像文件不存在: {args.image}")
        if args.backend == "pytorch":
            if model is None:
                model = load_pytorch_model(num_labels=len(id2label))
            result = predict_pytorch(model, args.image, id2label)
            print_result(result, backend="PyTorch")
        else:
            if not os.path.exists(ONNX_PATH):
                sys.exit(f"[错误] ONNX 模型不存在，请先运行 --export: {ONNX_PATH}")
            result = predict_onnx(ONNX_PATH, args.image, id2label)
            print_result(result, backend="ONNX Runtime")

    # 若未指定任何操作，默认执行完整流程（加载→导出ONNX→测试）
    if not args.export and not args.test and not args.image:
        if model is None:
            model = load_pytorch_model(num_labels=len(id2label))
        print("\n[i] 未指定操作，执行默认流程: 加载模型 → 导出 ONNX → 运行测试")
        export_onnx(model)
        run_test(model, id2label)


if __name__ == "__main__":
    main()
