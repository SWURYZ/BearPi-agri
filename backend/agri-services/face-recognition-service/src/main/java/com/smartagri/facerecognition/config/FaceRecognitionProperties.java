package com.smartagri.facerecognition.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "face-recognition")
public class FaceRecognitionProperties {

    /** ONNX 模型文件路径 */
    private String modelPath = "face/dream/dream_ijba_res18_naive.onnx";

    /** 人脸识别相似度阈值 (余弦相似度)，高于该值判定为同一人 */
    private double similarityThreshold = 0.82;

    /** 上传人脸图片存储目录 */
    private String storagePath = "data/face-images";
}
