package com.smartagri.facerecognition.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaceRecognizeResponse {
    /** 是否匹配到已注册人脸 */
    private boolean matched;
    /** 匹配到的人员 ID */
    private String personId;
    /** 匹配到的人员名称 */
    private String personName;
    /** 余弦相似度 */
    private double similarity;
    /** 使用的阈值 */
    private double threshold;
}
