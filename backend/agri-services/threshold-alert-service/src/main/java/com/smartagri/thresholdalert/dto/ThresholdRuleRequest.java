package com.smartagri.thresholdalert.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ThresholdRuleRequest(
        @NotBlank String deviceId,
        @NotBlank String metric,
        @NotBlank String operator,
        @NotNull @Positive Double threshold,
        Boolean enabled
) {
}
