package com.smartagri.facerecognition.service;

import com.smartagri.facerecognition.config.FaceRecognitionProperties;
import com.smartagri.facerecognition.dto.FaceRecognizeResponse;
import com.smartagri.facerecognition.dto.FaceRegisterResponse;
import com.smartagri.facerecognition.dto.FaceRecordInfo;
import com.smartagri.facerecognition.entity.FaceRecord;
import com.smartagri.facerecognition.repository.FaceRecordRepository;
import cn.smartjavaai.common.entity.face.LivenessResult;
import cn.smartjavaai.common.enums.face.LivenessStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceRecognitionService {

    private final SmartAIModelService smartAIModelService;
    private final FaceRecordRepository faceRecordRepository;
    private final FaceRecognitionProperties properties;

    /**
     * 注册人脸
     */
    @Transactional
    public FaceRegisterResponse register(MultipartFile imageFile, String personName, String personId) {
        if (!smartAIModelService.isReady()) {
            throw new IllegalStateException("人脸识别模型未就绪");
        }
        if (personId == null || personId.isBlank()) {
            personId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        if (faceRecordRepository.existsByPersonId(personId)) {
            throw new IllegalArgumentException("人员 ID 已存在: " + personId);
        }

        try {
            BufferedImage image = ImageIO.read(imageFile.getInputStream());
            if (image == null) {
                throw new IllegalArgumentException("无法解析图片文件，请上传 JPG/PNG 格式图片");
            }

            // 活体检测（如果启用）
            performLivenessCheck(image, "人脸注册");

            // 提取特征向量（SmartJavaAI：人脸检测 → 裁剪 → 对齐 → 特征提取）
            float[] embedding = smartAIModelService.extractFeatures(image);

            // 保存到数据库（只存特征向量，不保存照片）
            FaceRecord record = new FaceRecord();
            record.setPersonId(personId);
            record.setPersonName(personName);
            record.setEmbedding(floatsToBytes(embedding));
            faceRecordRepository.save(record);

            log.info("人脸注册成功: personId={}, personName={}, embeddingDim={}", personId, personName, embedding.length);
            return FaceRegisterResponse.builder()
                    .personId(personId)
                    .personName(personName)
                    .message("注册成功")
                    .build();
        } catch (Exception e) {
            log.error("人脸注册失败", e);
            throw new RuntimeException("人脸注册失败: " + e.getMessage(), e);
        }
    }

    /**
     * 1:N 人脸识别 —— 在所有已注册人脸中找到最匹配的
     */
    public FaceRecognizeResponse recognize(MultipartFile imageFile) {
        if (!smartAIModelService.isReady()) {
            throw new IllegalStateException("人脸识别模型未就绪");
        }

        try {
            BufferedImage image = ImageIO.read(imageFile.getInputStream());
            if (image == null) {
                throw new IllegalArgumentException("无法解析图片文件");
            }

            // 活体检测（如果启用）
            performLivenessCheck(image, "人脸识别");

            float[] queryEmbedding = smartAIModelService.extractFeatures(image);
            List<FaceRecord> allRecords = faceRecordRepository.findAll();

            if (allRecords.isEmpty()) {
                log.info("人脸识别: 数据库中无已注册人脸");
                return FaceRecognizeResponse.builder()
                        .matched(false)
                        .personId(null)
                        .personName(null)
                        .similarity(0)
                        .threshold(properties.getSimilarityThreshold())
                        .build();
            }

            String bestPersonId = null;
            String bestPersonName = null;
            double bestSimilarity = -1;

            for (FaceRecord record : allRecords) {
                float[] storedEmbedding = bytesToFloats(record.getEmbedding());
                double similarity = smartAIModelService.cosineSimilarity(queryEmbedding, storedEmbedding);
                log.debug("人脸比对: person={}, similarity={}", record.getPersonId(), similarity);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestPersonId = record.getPersonId();
                    bestPersonName = record.getPersonName();
                }
            }

            double threshold = properties.getSimilarityThreshold();
            boolean matched = bestSimilarity >= threshold;

            log.info("人脸识别完成: matched={}, bestSimilarity={}, bestPerson={}", matched, bestSimilarity, bestPersonId);
            return FaceRecognizeResponse.builder()
                    .matched(matched)
                    .personId(matched ? bestPersonId : null)
                    .personName(matched ? bestPersonName : null)
                    .similarity(bestSimilarity)
                    .threshold(threshold)
                    .build();
        } catch (Exception e) {
            log.error("人脸识别失败", e);
            throw new RuntimeException("人脸识别失败: " + e.getMessage(), e);
        }
    }

    /**
     * 1:1 人脸验证 —— 验证上传的人脸是否与指定 personId 匹配
     */
    public FaceRecognizeResponse verify(MultipartFile imageFile, String personId) {
        if (!smartAIModelService.isReady()) {
            throw new IllegalStateException("人脸识别模型未就绪");
        }

        FaceRecord record = faceRecordRepository.findByPersonId(personId)
                .orElseThrow(() -> new IllegalArgumentException("人员不存在: " + personId));

        try {
            BufferedImage image = ImageIO.read(imageFile.getInputStream());
            if (image == null) {
                throw new IllegalArgumentException("无法解析图片文件");
            }

            // 活体检测（如果启用）
            performLivenessCheck(image, "人脸验证");

            float[] queryEmbedding = smartAIModelService.extractFeatures(image);
            float[] storedEmbedding = bytesToFloats(record.getEmbedding());
            double similarity = smartAIModelService.cosineSimilarity(queryEmbedding, storedEmbedding);

            double threshold = properties.getSimilarityThreshold();
            boolean matched = similarity >= threshold;

            log.info("人脸验证完成: personId={}, matched={}, similarity={}", personId, matched, similarity);
            return FaceRecognizeResponse.builder()
                    .matched(matched)
                    .personId(personId)
                    .personName(record.getPersonName())
                    .similarity(similarity)
                    .threshold(threshold)
                    .build();
        } catch (Exception e) {
            log.error("人脸验证失败", e);
            throw new RuntimeException("人脸验证失败: " + e.getMessage(), e);
        }
    }

    /**
     * 查询所有已注册人脸
     */
    public List<FaceRecordInfo> listAll() {
        return faceRecordRepository.findAll().stream()
                .map(r -> FaceRecordInfo.builder()
                        .id(r.getId())
                        .personId(r.getPersonId())
                        .personName(r.getPersonName())
                        .createdAt(r.getCreatedAt())
                        .updatedAt(r.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * 删除已注册人脸
     */
    @Transactional
    public void delete(String personId) {
        if (!faceRecordRepository.existsByPersonId(personId)) {
            throw new IllegalArgumentException("人员不存在: " + personId);
        }
        faceRecordRepository.deleteByPersonId(personId);
        log.info("人脸记录已删除: personId={}", personId);
    }

    // ======================== 工具方法 ========================

    /**
     * 执行活体检测校验。如果活体检测启用且检测到非真人，抛出异常。
     */
    private void performLivenessCheck(BufferedImage image, String scene) {
        if (!properties.isLivenessEnabled() || !smartAIModelService.isLivenessReady()) {
            return;
        }
        LivenessResult result = smartAIModelService.checkLiveness(image);
        if (result == null) {
            log.warn("{}活体检测无结果（未检测到人脸或检测异常），跳过", scene);
            return;
        }
        LivenessStatus status = result.getStatus();
        log.info("{}活体检测: status={}, score={}", scene, status.getDescription(), result.getScore());
        if (status != LivenessStatus.LIVE) {
            throw new IllegalArgumentException(
                    String.format("活体检测未通过：%s（得分 %.4f）。请确保本人在摄像头前操作，不要使用照片或视频。",
                            status.getDescription(), result.getScore()));
        }
    }

    /**
     * 独立的活体检测接口，供前端调用预检。
     * @return LivenessResult 或 null（活体检测不可用）
     */
    public LivenessResult checkLiveness(MultipartFile imageFile) {
        if (!properties.isLivenessEnabled() || !smartAIModelService.isLivenessReady()) {
            return null;
        }
        try {
            BufferedImage image = ImageIO.read(imageFile.getInputStream());
            if (image == null) {
                throw new IllegalArgumentException("无法解析图片文件");
            }
            return smartAIModelService.checkLiveness(image);
        } catch (IOException e) {
            throw new RuntimeException("活体检测失败: " + e.getMessage(), e);
        }
    }

    static byte[] floatsToBytes(float[] floats) {
        ByteBuffer buf = ByteBuffer.allocate(floats.length * 4);
        buf.order(ByteOrder.LITTLE_ENDIAN);
        for (float f : floats) buf.putFloat(f);
        return buf.array();
    }

    static float[] bytesToFloats(byte[] bytes) {
        ByteBuffer buf = ByteBuffer.wrap(bytes);
        buf.order(ByteOrder.LITTLE_ENDIAN);
        float[] floats = new float[bytes.length / 4];
        for (int i = 0; i < floats.length; i++) floats[i] = buf.getFloat();
        return floats;
    }
}
