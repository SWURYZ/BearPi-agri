package com.smartagri.devicecontrol.dto;

public record DeviceStatusResponse(
        String deviceId,
        String ledStatus,
        String motorStatus,
        String lastUpdated
) {
}
