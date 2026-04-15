package com.smartagri.iotaccess.dto;

public record ActuatorControlRequest(
        String led,
        String motor
) {
}
