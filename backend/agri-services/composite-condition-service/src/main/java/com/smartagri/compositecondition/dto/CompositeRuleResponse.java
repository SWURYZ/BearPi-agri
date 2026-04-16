package com.smartagri.compositecondition.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 复合条件规则响应 DTO
 */
public record CompositeRuleResponse(
        Long id,
        String name,
        String description,
        String logicOperator,
        boolean enabled,
        String targetDeviceId,
        String commandType,
        String commandAction,
        List<RuleConditionResponse> conditions,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
