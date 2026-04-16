package com.smartagri.historicalanalysis.dto;

import java.time.LocalDateTime;

public record RealtimeMetricsResponse(
        String greenhouse,
        String deviceId,
        Double temp,
        Double humidity,
        Double light,
        LocalDateTime timestamp
) {
}
