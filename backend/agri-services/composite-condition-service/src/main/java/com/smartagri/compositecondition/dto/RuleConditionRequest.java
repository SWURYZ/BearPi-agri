package com.smartagri.compositecondition.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * 规则子条件请求 DTO
 */
public record RuleConditionRequest(
        @NotBlank String sensorMetric,
        @NotBlank String sourceDeviceId,
        @Pattern(regexp = "GT|GTE|LT|LTE|EQ|NEQ", message = "operator must be GT/GTE/LT/LTE/EQ/NEQ")
        @NotBlank String operator,
        @NotNull Double threshold
) {
}
