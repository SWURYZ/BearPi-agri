package com.smartagri.thresholdalert.dto;

import java.time.LocalDateTime;

public record AlertRecordDto(
        Long id,
        Long ruleId,
        String deviceId,
        String metric,
        String operator,
        Double threshold,
        Double currentValue,
        String message,
        LocalDateTime alertedAt
) {
}
