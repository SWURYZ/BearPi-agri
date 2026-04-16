package com.smartagri.compositecondition.dto;

import java.time.LocalDateTime;

/**
 * 联动操作日志响应 DTO
 */
public record LinkageLogResponse(
        Long id,
        Long ruleId,
        String ruleName,
        String conditionSnapshot,
        String targetDeviceId,
        String commandType,
        String commandAction,
        String dispatchStatus,
        String cloudMessageId,
        String errorMessage,
        LocalDateTime triggeredAt
) {
}
