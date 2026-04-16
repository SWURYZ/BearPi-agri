package com.smartagri.greenhousemonitor.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 设备绑定/更新请求 DTO
 * 流程：扫描新设备二维码 → 填写或解析设备信息 → 调用此接口完成绑定
 */
public record DeviceBindRequest(
        @NotBlank String deviceId,
        String deviceName,
        String deviceType,
        @NotBlank String greenhouseCode
) {
}
