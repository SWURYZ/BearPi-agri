package com.smartagri.facerecognition.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaceRecordInfo {
    private Long id;
    private String personId;
    private String personName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
