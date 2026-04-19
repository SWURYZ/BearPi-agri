package com.smartagri.thresholdalert.dto;

import java.math.BigDecimal;

public record ThresholdRuleResponse(
        Long id,
        String deviceId,
        BigDecimal temperatureMin,
        BigDecimal temperatureMax,
        BigDecimal humidityMin,
        BigDecimal humidityMax,
        BigDecimal lightMin,
        BigDecimal lightMax,
        BigDecimal co2Min,
        BigDecimal co2Max,
        BigDecimal soilHumidityMin,
        BigDecimal soilHumidityMax,
        BigDecimal soilTemperatureMin,
        BigDecimal soilTemperatureMax,
        boolean enabled,
        String createdAt,
        String updatedAt
) {
}
