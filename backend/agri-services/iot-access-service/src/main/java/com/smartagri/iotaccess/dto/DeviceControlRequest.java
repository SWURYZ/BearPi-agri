package com.smartagri.iotaccess.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

public record DeviceControlRequest(
        @NotBlank String deviceId,
        @NotBlank String commandType,
        @NotEmpty Map<String, Object> params,
        String requestId
) {
}
