package com.smartagri.greenhousemonitor.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 创建/更新大棚请求 DTO
 */
public record GreenhouseRequest(
        @NotBlank String code,
        @NotBlank String name,
        String location,
        Double areaSqm,
        String cropType,
        boolean enabled
) {
}
