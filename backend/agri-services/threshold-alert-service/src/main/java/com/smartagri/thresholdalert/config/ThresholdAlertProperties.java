package com.smartagri.thresholdalert.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "threshold-alert")
public record ThresholdAlertProperties(
        String iotStatusBaseUrl,
        String deviceControlBaseUrl,
        long pollIntervalMs,
        String runtimeDeviceId
) {
}
