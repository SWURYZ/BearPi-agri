package com.smartagri.devicecontrol.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.devicecontrol.domain.entity.ControlCommand;
import com.smartagri.devicecontrol.dto.DeviceStatusResponse;
import com.smartagri.devicecontrol.dto.ManualControlRequest;
import com.smartagri.devicecontrol.dto.ManualControlResponse;
import com.smartagri.devicecontrol.service.DeviceControlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/device-control")
public class DeviceControlController {

    private final DeviceControlService deviceControlService;

    /**
     * 手动控制设备 – 前端点击按钮调用此接口
     */
    @PostMapping("/manual")
    public ApiResponse<ManualControlResponse> manualControl(@Valid @RequestBody ManualControlRequest request) {
        ManualControlResponse response = deviceControlService.manualControl(
                request.deviceId(), request.commandType(), request.action());
        return ApiResponse.success(response);
    }

    /**
     * 查询设备当前状态
     */
    @GetMapping("/devices/{deviceId}/status")
    public ApiResponse<DeviceStatusResponse> deviceStatus(@PathVariable("deviceId") String deviceId) {
        return ApiResponse.success(deviceControlService.getDeviceStatus(deviceId));
    }

    /**
     * 查询设备控制指令历史
     */
    @GetMapping("/devices/{deviceId}/commands")
    public ApiResponse<List<ControlCommand>> commandHistory(@PathVariable("deviceId") String deviceId) {
        return ApiResponse.success(deviceControlService.getCommandHistory(deviceId));
    }

    /**
     * 根据 requestId 查询指令状态
     */
    @GetMapping("/commands/{requestId}")
    public ResponseEntity<ApiResponse<ControlCommand>> commandDetail(@PathVariable("requestId") String requestId) {
        return deviceControlService.getCommandByRequestId(requestId)
                .map(cmd -> ResponseEntity.ok(ApiResponse.success(cmd)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * 接收设备执行反馈回调（云平台回调或内部调用）
     */
    @PostMapping("/feedback/{cloudMessageId}")
    public ApiResponse<String> feedback(@PathVariable("cloudMessageId") String cloudMessageId,
                                        @RequestBody FeedbackPayload payload) {
        deviceControlService.handleFeedback(cloudMessageId, payload.resultCode());
        return ApiResponse.success("反馈已处理");
    }

    public record FeedbackPayload(String resultCode) {
    }
}
