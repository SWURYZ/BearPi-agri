package com.smartagri.greenhousemonitor.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Scan-bind request from QR scanner page.
 */
public record DeviceScanBindRequest(
        @NotBlank String qrContent,
        String greenhouseCode
) {
}
