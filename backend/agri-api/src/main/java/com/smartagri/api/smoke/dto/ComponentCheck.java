package com.smartagri.api.smoke.dto;

public record ComponentCheck(
        String name,
        String status,
        String detail
) {
}
