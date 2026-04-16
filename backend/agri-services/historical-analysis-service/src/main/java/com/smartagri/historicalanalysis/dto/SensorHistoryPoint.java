package com.smartagri.historicalanalysis.dto;

import java.time.LocalDateTime;

public record SensorHistoryPoint(
        String time,
        LocalDateTime timestamp,
        Double value
) {
}
