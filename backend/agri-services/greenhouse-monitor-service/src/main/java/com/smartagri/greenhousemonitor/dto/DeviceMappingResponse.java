package com.smartagri.greenhousemonitor.dto;

import java.time.LocalDateTime;

/**
 * 设备与大棚绑定关系响应 DTO
 */
public record DeviceMappingResponse(
        Long id,
        String deviceId,
        String deviceName,
        String deviceType,
        String greenhouseCode,
        String status,
        LocalDateTime boundAt,
        LocalDateTime unboundAt,
        LocalDateTime updatedAt
) {
}
