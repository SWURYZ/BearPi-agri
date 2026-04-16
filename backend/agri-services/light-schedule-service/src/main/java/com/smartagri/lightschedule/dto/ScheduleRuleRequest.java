package com.smartagri.lightschedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ScheduleRuleRequest(
        @NotBlank String deviceId,
        @NotBlank String ruleName,
        @NotNull String turnOnTime,
        @NotNull String turnOffTime,
        String repeatMode,
        String commandType,
        Boolean enabled
) {
}
