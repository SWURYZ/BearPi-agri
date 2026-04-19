package com.smartagri.thresholdalert.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SensorReadingIngestRequest(
        @NotBlank String deviceId,
        @NotNull BigDecimal temperature,
        @NotNull BigDecimal humidity,
        BigDecimal light,
        BigDecimal co2,
        BigDecimal soilHumidity,
        BigDecimal soilTemperature,
        String collectedAt
) {
}
