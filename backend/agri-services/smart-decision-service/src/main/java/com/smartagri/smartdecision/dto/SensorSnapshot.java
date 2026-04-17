package com.smartagri.smartdecision.dto;

import java.time.LocalDateTime;

public record SensorSnapshot(
        Double temperature,
        Double humidity,
        Double luminance,
        String ledStatus,
        String motorStatus,
        LocalDateTime reportTime
) {}
