package com.smartagri.facerecognition.service;

import ai.onnxruntime.*;
import com.smartagri.facerecognition.config.FaceRecognitionProperties;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.nio.FloatBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Collections;

/**
 * ONNX 模型推理服务 —— 加载人脸特征提取模型，将人脸图片转换为特征向量。
 */
@Slf4j
@Service
public class OnnxModelService {

    private final FaceRecognitionProperties properties;
    private OrtEnvironment env;
    private OrtSession session;
    private String inputName;
    private String outputName;
    private int inputHeight = 112;
    private int inputWidth = 112;
    private boolean ready = false;

    public OnnxModelService(FaceRecognitionProperties properties) {
        this.properties = properties;
        init();
    }

    private void init() {
        try {
            Path modelFile = Paths.get(properties.getModelPath()).toAbsolutePath();
            if (!Files.exists(modelFile)) {
                log.error("ONNX 模型文件不存在: {}，人脸识别功能不可用。请检查 face-recognition.model-path 配置。", modelFile);
                return;
            }

            env = OrtEnvironment.getEnvironment();
            OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
            opts.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.BASIC_OPT);
            session = env.createSession(modelFile.toString(), opts);

            // 自动检测模型输入输出
            inputName = session.getInputNames().iterator().next();
            outputName = session.getOutputNames().iterator().next();

            NodeInfo inputInfo = session.getInputInfo().get(inputName);
            TensorInfo inputTensor = (TensorInfo) inputInfo.getInfo();
            long[] shape = inputTensor.getShape();
            // shape 通常为 [batch, channels, height, width] 或 [batch, height, width, channels]
            if (shape.length == 4 && shape[1] == 3) {
                inputHeight = (int) shape[2];
                inputWidth = (int) shape[3];
            } else if (shape.length == 4 && shape[3] == 3) {
                inputHeight = (int) shape[1];
                inputWidth = (int) shape[2];
            }

            ready = true;
            log.info("ONNX 模型加载成功: {}", modelFile);
            log.info("  输入: name={}, shape={}", inputName, Arrays.toString(shape));
            log.info("  输出: name={}", outputName);
            log.info("  预处理尺寸: {}x{}", inputWidth, inputHeight);
        } catch (OrtException e) {
            log.error("ONNX 模型加载失败: {}", e.getMessage(), e);
        }
    }

    public boolean isReady() {
        return ready;
    }

    /**
     * 从人脸图片中提取特征向量
     *
     * @param faceImage 人脸图像 (RGB BufferedImage)
     * @return 归一化后的特征向量
     */
    public float[] extractFeatures(BufferedImage faceImage) throws OrtException {
        if (!ready) {
            throw new IllegalStateException("ONNX 模型未就绪，无法提取特征");
        }

        float[] inputData = preprocess(faceImage);

        OnnxTensor tensor = OnnxTensor.createTensor(env,
                FloatBuffer.wrap(inputData), new long[]{1, 3, inputHeight, inputWidth});

        try (OrtSession.Result result = session.run(Collections.singletonMap(inputName, tensor))) {
            float[][] output = (float[][]) result.get(0).getValue();
            float[] embedding = output[0];
            // L2 归一化
            normalize(embedding);
            return embedding;
        } finally {
            tensor.close();
        }
    }

    /**
     * 图像预处理：缩放、归一化、转换为 CHW float 数组
     */
    private float[] preprocess(BufferedImage image) {
        // 1. 中心裁剪：摄像头图像中人脸通常居中偏上，裁剪中心区域以去除大部分背景
        BufferedImage cropped = centerCropFaceRegion(image);

        // 2. 缩放到模型要求的尺寸
        BufferedImage resized = new BufferedImage(inputWidth, inputHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resized.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(cropped, 0, 0, inputWidth, inputHeight, null);
        g.dispose();

        // 3. 转换为 CHW (channels, height, width) 并归一化到 [-1, 1]
        float[] data = new float[3 * inputHeight * inputWidth];
        for (int y = 0; y < inputHeight; y++) {
            for (int x = 0; x < inputWidth; x++) {
                int rgb = resized.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF;
                int gVal = (rgb >> 8) & 0xFF;
                int b = rgb & 0xFF;
                data[0 * inputHeight * inputWidth + y * inputWidth + x] = (r / 255.0f - 0.5f) / 0.5f;
                data[1 * inputHeight * inputWidth + y * inputWidth + x] = (gVal / 255.0f - 0.5f) / 0.5f;
                data[2 * inputHeight * inputWidth + y * inputWidth + x] = (b / 255.0f - 0.5f) / 0.5f;
            }
        }
        return data;
    }

    /**
     * 从摄像头图像中裁剪人脸区域（中心偏上）。
     * 摄像头采集的图像中人脸通常位于画面中心偏上 1/3 区域，
     * 裁剪正方形区域可以大幅减少背景干扰，提升特征区分度。
     */
    private BufferedImage centerCropFaceRegion(BufferedImage image) {
        int w = image.getWidth();
        int h = image.getHeight();
        // 裁剪尺寸：取短边的 55%，聚焦人脸
        int cropSize = (int) (Math.min(w, h) * 0.55);
        // 水平居中
        int x = (w - cropSize) / 2;
        // 垂直偏上 (人脸通常在上 1/3 区域)
        int y = Math.max(0, (int) (h * 0.15));
        // 确保不越界
        if (x + cropSize > w) x = w - cropSize;
        if (y + cropSize > h) y = h - cropSize;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        int actualSize = Math.min(cropSize, Math.min(w - x, h - y));
        return image.getSubimage(x, y, actualSize, actualSize);
    }

    /** L2 归一化 */
    private void normalize(float[] vec) {
        double norm = 0;
        for (float v : vec) norm += v * v;
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < vec.length; i++) {
                vec[i] = (float) (vec[i] / norm);
            }
        }
    }

    /**
     * 计算两个特征向量的余弦相似度
     */
    public double cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) {
            throw new IllegalArgumentException("特征向量维度不匹配: " + a.length + " vs " + b.length);
        }
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    @PreDestroy
    public void destroy() {
        try {
            if (session != null) session.close();
        } catch (OrtException e) {
            log.warn("关闭 ONNX Session 失败", e);
        }
    }
}
