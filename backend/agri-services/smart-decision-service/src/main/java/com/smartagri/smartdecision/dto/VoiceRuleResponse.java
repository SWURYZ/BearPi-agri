package com.smartagri.smartdecision.dto;

import java.util.List;

/**
 * 语音规则解析结果 —— 将自然语言指令解析为结构化规则参数
 */
public record VoiceRuleResponse(
        String ruleType,           // SCHEDULE | LINKAGE | THRESHOLD
        String ruleName,
        ScheduleParams schedule,   // ruleType=SCHEDULE 时有值
        LinkageParams linkage,     // ruleType=LINKAGE 时有值
        ThresholdParams threshold, // ruleType=THRESHOLD 时有值
        String explanation
) {
    public record ScheduleParams(
            String turnOnTime,     // HH:mm
            String turnOffTime,    // HH:mm
            String commandType     // LIGHT_CONTROL | MOTOR_CONTROL
    ) {}

    public record LinkageParams(
            List<ConditionParam> conditions,
            String logicOperator,  // AND | OR
            String commandType,    // LIGHT_CONTROL | MOTOR_CONTROL
            String commandAction   // ON | OFF
    ) {}

    public record ConditionParam(
            String sensorMetric,   // temperature | humidity | luminance
            String operator,       // GT | GTE | LT | LTE
            double threshold
    ) {}

    public record ThresholdParams(
            String metric,         // temperature | humidity | luminance
            String operator,       // ABOVE | BELOW
            double threshold
    ) {}
}
