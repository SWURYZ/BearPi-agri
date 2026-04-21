package com.smartagri.smartdecision.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 语音规则解析请求
 */
public record VoiceRuleRequest(
        @NotBlank(message = "语音指令不能为空") String command,
        String deviceId
) {}
