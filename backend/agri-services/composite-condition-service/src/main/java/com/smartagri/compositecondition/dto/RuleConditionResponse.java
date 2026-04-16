package com.smartagri.compositecondition.dto;

/**
 * 规则子条件响应 DTO
 */
public record RuleConditionResponse(
        Long id,
        String sensorMetric,
        String sourceDeviceId,
        String operator,
        Double threshold
) {
}
