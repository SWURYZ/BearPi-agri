package com.smartagri.compositecondition.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * 创建/更新复合条件规则的请求体
 */
public record CompositeRuleRequest(
        @NotBlank String name,
        String description,
        @Pattern(regexp = "AND|OR", message = "logicOperator must be AND or OR")
        String logicOperator,
        boolean enabled,
        @NotBlank String targetDeviceId,
        @NotBlank String commandType,
        @NotBlank String commandAction,
        @NotEmpty @Valid List<RuleConditionRequest> conditions
) {
}
