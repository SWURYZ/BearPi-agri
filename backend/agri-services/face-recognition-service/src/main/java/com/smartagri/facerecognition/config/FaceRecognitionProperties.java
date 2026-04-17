package com.smartagri.facerecognition.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "face-recognition")
public class FaceRecognitionProperties {

    /** 人脸检测模型枚举名（对应 SmartJavaAI FaceDetModelEnum） */
    private String detModelEnum = "RETINA_FACE";

    /** 人脸检测模型文件路径 */
    private String detModelPath;

    /** 人脸识别模型枚举名（对应 SmartJavaAI FaceRecModelEnum） */
    private String recModelEnum = "INSIGHT_FACE_IRSE50_MODEL";

    /** 人脸识别模型文件路径 */
    private String recModelPath;

    /** 人脸识别相似度阈值，高于该值判定为同一人（InsightFace 推荐 0.62） */
    private double similarityThreshold = 0.62;

    /** 人脸检测置信度阈值 */
    private float confidenceThreshold = 0.5f;

    /** 上传人脸图片存储目录 */
    private String storagePath = "data/face-images";

    // ===== 活体检测配置 =====

    /** 是否启用活体检测 */
    private boolean livenessEnabled = true;

    /** 活体检测模型枚举名（IIC_FL_MODEL / MINI_VISION_MODEL） */
    private String livenessModelEnum = "IIC_FL_MODEL";

    /** 活体检测模型文件路径 */
    private String livenessModelPath = "models/liveness/IIC_Fl.onnx";

    /** 活体检测阈值（超过此值判定为真人，默认 0.8） */
    private float livenessThreshold = 0.8f;
}
