package com.smartagri.greenhousemonitor.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 传感器数据上报请求 DTO
 */
public record SensorSnapshotRequest(
        @NotBlank String greenhouseCode,
        @NotBlank String metric,
        Double value,
        String unit,
        String sourceDeviceId
) {
}
