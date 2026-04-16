package com.smartagri.devicecontrol.dto;

public record ManualControlResponse(
        String requestId,
        String cloudMessageId,
        String status,
        String message
) {
}
