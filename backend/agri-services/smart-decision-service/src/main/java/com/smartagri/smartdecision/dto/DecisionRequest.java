package com.smartagri.smartdecision.dto;

import jakarta.validation.constraints.NotBlank;

public record DecisionRequest(
        @NotBlank(message = "query不能为空") String query,
        String deviceId,
        String greenhouseCode,
        String scenario,
        String userId
) {}
