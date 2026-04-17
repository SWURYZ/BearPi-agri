package com.smartagri.thresholdalert.dto;

import java.util.List;

public record IngestResultResponse(
        String deviceId,
        String processedAt,
        int alertCount,
        List<ThresholdAlertRecordResponse> alerts
) {
}
