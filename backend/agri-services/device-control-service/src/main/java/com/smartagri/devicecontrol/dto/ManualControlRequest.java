package com.smartagri.devicecontrol.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ManualControlRequest(
        @NotBlank String deviceId,
        @NotBlank String commandType,
        @NotNull String action
) {
}
