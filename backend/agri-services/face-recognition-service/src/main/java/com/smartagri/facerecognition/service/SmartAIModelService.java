package com.smartagri.facerecognition.service;

import cn.smartjavaai.common.entity.R;
import cn.smartjavaai.common.enums.DeviceEnum;
import cn.smartjavaai.face.config.FaceDetConfig;
import cn.smartjavaai.face.config.FaceRecConfig;
import cn.smartjavaai.face.config.LivenessConfig;
import cn.smartjavaai.face.constant.FaceDetectConstant;
import cn.smartjavaai.face.constant.LivenessConstant;
import cn.smartjavaai.face.enums.FaceDetModelEnum;
import cn.smartjavaai.face.enums.FaceRecModelEnum;
import cn.smartjavaai.face.enums.LivenessModelEnum;
import cn.smartjavaai.face.factory.FaceDetModelFactory;
import cn.smartjavaai.face.factory.FaceRecModelFactory;
import cn.smartjavaai.face.factory.LivenessModelFactory;
import cn.smartjavaai.face.model.facedect.FaceDetModel;
import cn.smartjavaai.face.model.facerec.FaceRecModel;
import cn.smartjavaai.face.model.liveness.LivenessDetModel;
import cn.smartjavaai.common.entity.face.LivenessResult;
import com.smartagri.facerecognition.config.FaceRecognitionProperties;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;

/**
 * 基于 SmartJavaAI SDK 的人脸模型推理服务。
 * <p>
 * 集成人脸检测（FaceDetModel）+ 人脸识别（FaceRecModel），
 * 支持人脸特征提取和特征向量相似度比对。
 * <p>
 * 模型下载地址：<a href="https://pan.baidu.com/s/10l22x5fRz_gwLr8EAHa1Jg?pwd=1234">百度网盘</a>
 */
@Slf4j
@Service
public class SmartAIModelService {

    private final FaceRecognitionProperties properties;
    private FaceRecModel faceRecModel;
    private LivenessDetModel livenessDetModel;
    private boolean ready = false;
    private boolean livenessReady = false;

    public SmartAIModelService(FaceRecognitionProperties properties) {
        this.properties = properties;
        init();
    }

    private void init() {
        try {
            log.info("正在初始化 SmartJavaAI 人脸模型...");

            // ========== 1. 人脸检测模型 ==========
            FaceDetConfig detConfig = new FaceDetConfig();
            detConfig.setModelEnum(FaceDetModelEnum.valueOf(properties.getDetModelEnum()));
            if (properties.getDetModelPath() != null && !properties.getDetModelPath().isBlank()) {
                detConfig.setModelPath(properties.getDetModelPath());
            }
            detConfig.setConfidenceThreshold(properties.getConfidenceThreshold());
            detConfig.setNmsThresh(FaceDetectConstant.NMS_THRESHOLD);
            FaceDetModel faceDetModel = FaceDetModelFactory.getInstance().getModel(detConfig);
            log.info("人脸检测模型加载成功: enum={}, path={}", properties.getDetModelEnum(), properties.getDetModelPath());

            // ========== 2. 人脸识别模型 ==========
            FaceRecConfig recConfig = new FaceRecConfig();
            recConfig.setModelEnum(FaceRecModelEnum.valueOf(properties.getRecModelEnum()));
            if (properties.getRecModelPath() != null && !properties.getRecModelPath().isBlank()) {
                recConfig.setModelPath(properties.getRecModelPath());
            }
            recConfig.setCropFace(true);   // 自动裁剪人脸
            recConfig.setAlign(true);      // 开启人脸对齐，提升准确度
            recConfig.setDevice(DeviceEnum.CPU);
            recConfig.setDetectModel(faceDetModel);
            faceRecModel = FaceRecModelFactory.getInstance().getModel(recConfig);
            log.info("人脸识别模型加载成功: enum={}, path={}", properties.getRecModelEnum(), properties.getRecModelPath());

            ready = true;
            log.info("SmartJavaAI 人脸模型全部就绪");

            // ========== 3. 活体检测模型（可选） ==========
            if (properties.isLivenessEnabled()) {
                try {
                    LivenessConfig livenessConfig = new LivenessConfig();
                    livenessConfig.setModelEnum(LivenessModelEnum.valueOf(properties.getLivenessModelEnum()));
                    livenessConfig.setDevice(DeviceEnum.CPU);
                    if (properties.getLivenessModelPath() != null && !properties.getLivenessModelPath().isBlank()) {
                        livenessConfig.setModelPath(properties.getLivenessModelPath());
                    }
                    livenessConfig.setRealityThreshold(properties.getLivenessThreshold());
                    livenessConfig.setFrameCount(LivenessConstant.DEFAULT_FRAME_COUNT);
                    livenessConfig.setMaxVideoDetectFrames(LivenessConstant.DEFAULT_MAX_VIDEO_DETECT_FRAMES);
                    livenessConfig.setDetectModel(faceDetModel);
                    livenessDetModel = LivenessModelFactory.getInstance().getModel(livenessConfig);
                    livenessReady = true;
                    log.info("活体检测模型加载成功: enum={}, path={}, threshold={}",
                            properties.getLivenessModelEnum(), properties.getLivenessModelPath(), properties.getLivenessThreshold());
                } catch (Exception e) {
                    log.error("活体检测模型加载失败: {}。活体检测功能不可用。", e.getMessage(), e);
                }
            } else {
                log.info("活体检测已禁用（face-recognition.liveness-enabled=false）");
            }
        } catch (Exception e) {
            log.error("SmartJavaAI 人脸模型加载失败: {}。人脸识别功能不可用。", e.getMessage(), e);
        }
    }

    public boolean isReady() {
        return ready;
    }

    public boolean isLivenessReady() {
        return livenessReady;
    }

    /**
     * 静态活体检测：判断图片中分数最高的人脸是否为真人。
     *
     * @param faceImage 包含人脸的图片
     * @return LivenessResult（含 status 和 score），null 表示活体检测未启用
     */
    public LivenessResult checkLiveness(BufferedImage faceImage) {
        if (!livenessReady) {
            return null; // 活体检测未启用或模型未加载
        }
        try {
            R<LivenessResult> result = livenessDetModel.detectTopFace(faceImage);
            if (result.isSuccess()) {
                return result.getData();
            }
            log.warn("活体检测失败: {}", result.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("活体检测异常: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 从图片中检测并提取分数最高的人脸特征向量。
     * <p>
     * 内部流程：人脸检测 → 裁剪最高分人脸 → 对齐 → 提取特征 → 返回 float[]
     *
     * @param faceImage 包含人脸的图片
     * @return 归一化的人脸特征向量
     */
    public float[] extractFeatures(BufferedImage faceImage) {
        if (!ready) {
            throw new IllegalStateException("人脸识别模型未就绪，请检查模型文件配置");
        }
        try {
            R<float[]> result = faceRecModel.extractTopFaceFeature(faceImage);
            if (result.isSuccess()) {
                return result.getData();
            }
            throw new RuntimeException("人脸特征提取失败: " + result.getMessage());
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("人脸特征提取失败: " + e.getMessage(), e);
        }
    }

    /**
     * 计算两个人脸特征向量的相似度。
     *
     * @param a 特征向量 A
     * @param b 特征向量 B
     * @return 相似度（余弦相似度），范围 0~1
     */
    public double cosineSimilarity(float[] a, float[] b) {
        if (!ready) {
            throw new IllegalStateException("人脸识别模型未就绪");
        }
        return faceRecModel.calculSimilar(a, b);
    }

    @PreDestroy
    public void destroy() {
        log.info("SmartJavaAI 人脸模型资源释放");
        // SmartJavaAI 内部管理资源生命周期
    }
}
