package com.smartagri.thresholdalert.dto;

import java.math.BigDecimal;

public record ThresholdAlertRecordResponse(
        Long id,
        String deviceId,
        String metricType,
        BigDecimal currentValue,
        BigDecimal minThreshold,
        BigDecimal maxThreshold,
        String alertMessage,
        String alertedAt
) {
}
