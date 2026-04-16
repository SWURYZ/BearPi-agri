package com.smartagri.compositecondition.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 传感器数据上报请求 DTO（由 IoT 接入层或外部系统调用）
 */
public record SensorDataRequest(
        @NotBlank String deviceId,
        @NotBlank String metric,
        @NotNull Double value
) {
}
