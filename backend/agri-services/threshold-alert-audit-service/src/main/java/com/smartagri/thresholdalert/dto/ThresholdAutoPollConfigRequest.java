package com.smartagri.thresholdalert.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ThresholdAutoPollConfigRequest(
        @NotNull
        @Min(1)
        @Max(1440)
        Integer pollIntervalMinutes
) {
}
