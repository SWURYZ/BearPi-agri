package com.smartagri.greenhousemonitor.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 大棚概览 DTO – 包含最新各指标传感器数据，用于大屏或卡片展示
 */
public record GreenhouseOverviewResponse(
        Long id,
        String code,
        String name,
        String location,
        Double areaSqm,
        String cropType,
        boolean enabled,
        List<SensorMetricEntry> latestMetrics,
        int boundDeviceCount
) {
    public record SensorMetricEntry(
            String metric,
            Double value,
            String unit,
            String sourceDeviceId,
            LocalDateTime reportedAt
    ) {
    }
}
