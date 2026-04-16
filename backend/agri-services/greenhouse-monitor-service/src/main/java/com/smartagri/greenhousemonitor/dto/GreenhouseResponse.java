package com.smartagri.greenhousemonitor.dto;

import java.time.LocalDateTime;

/**
 * 大棚响应 DTO
 */
public record GreenhouseResponse(
        Long id,
        String code,
        String name,
        String location,
        Double areaSqm,
        String cropType,
        boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
