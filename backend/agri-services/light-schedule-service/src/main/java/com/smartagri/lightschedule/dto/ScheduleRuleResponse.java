package com.smartagri.lightschedule.dto;

public record ScheduleRuleResponse(
        Long id,
        String deviceId,
        String ruleName,
        String turnOnTime,
        String turnOffTime,
        boolean enabled,
        String repeatMode,
        String commandType,
        String createdAt
) {
}
