package com.smartagri.iotaccess.dto;

public record CommandDispatchResponse(
        String requestId,
        String cloudCommandId,
        String status,
        String message
) {
}
