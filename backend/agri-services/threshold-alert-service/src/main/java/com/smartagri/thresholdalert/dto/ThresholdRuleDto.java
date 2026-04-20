package com.smartagri.thresholdalert.dto;

import java.time.LocalDateTime;

public record ThresholdRuleDto(
        Long id,
        String deviceId,
        String metric,
        String operator,
        Double threshold,
        boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
