package com.smartagri.iotaccess.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.iotaccess.domain.entity.DeviceCommandLog;
import com.smartagri.iotaccess.domain.entity.DeviceTelemetry;
import com.smartagri.iotaccess.dto.ActuatorControlRequest;
import com.smartagri.iotaccess.dto.CommandDispatchResponse;
import com.smartagri.iotaccess.dto.DeviceControlRequest;
import com.smartagri.iotaccess.service.HuaweiIotCommandService;
import com.smartagri.iotaccess.service.TelemetryIngestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/iot")
public class IotAccessController {

    private final TelemetryIngestionService telemetryIngestionService;
    private final HuaweiIotCommandService commandService;

    @GetMapping("/devices/{deviceId}/latest")
    public ApiResponse<DeviceTelemetry> latest(@PathVariable String deviceId) {
        return ApiResponse.success(telemetryIngestionService.latest(deviceId));
    }

    @GetMapping("/devices/{deviceId}/telemetry")
    public ApiResponse<java.util.List<DeviceTelemetry>> telemetry(
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "60") int minutes) {
        return ApiResponse.success(telemetryIngestionService.recent(deviceId, minutes));
    }

    @GetMapping("/devices/{deviceId}/status")
    public ApiResponse<Map<String, Object>> status(@PathVariable String deviceId) {
        DeviceTelemetry latest = telemetryIngestionService.latest(deviceId);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("deviceId", deviceId);
        payload.put("reportTime", latest == null ? null : latest.getReportTime());
        payload.put("led", latest == null ? null : latest.getLedStatus());
        payload.put("motor", latest == null ? null : latest.getMotorStatus());
        payload.put("temperature", latest == null ? null : latest.getTemperature());
        payload.put("humidity", latest == null ? null : latest.getHumidity());
        payload.put("luminance", latest == null ? null : latest.getLuminance());
        return ApiResponse.success(payload);
    }

    @PostMapping("/commands")
    public ApiResponse<CommandDispatchResponse> sendCommand(@Valid @RequestBody DeviceControlRequest request) {
        return ApiResponse.success(commandService.dispatch(request));
    }

    @PutMapping("/devices/{deviceId}/actuators")
    public ApiResponse<Map<String, CommandDispatchResponse>> controlActuator(
            @PathVariable String deviceId,
            @RequestBody ActuatorControlRequest request) {
        Map<String, CommandDispatchResponse> result = new LinkedHashMap<>();

        if (request.led() != null) {
            result.put("led", commandService.dispatch(new DeviceControlRequest(
                    deviceId,
                    "LIGHT_CONTROL",
                    Map.of("Light", request.led()),
                    UUID.randomUUID().toString()
            )));
        }
        if (request.motor() != null) {
            result.put("motor", commandService.dispatch(new DeviceControlRequest(
                    deviceId,
                    "MOTOR_CONTROL",
                    Map.of("Motor", request.motor()),
                    UUID.randomUUID().toString()
            )));
        }
        return ApiResponse.success(result);
    }

    @GetMapping("/commands/request/{requestId}")
    public ResponseEntity<ApiResponse<DeviceCommandLog>> queryCommand(@PathVariable String requestId) {
        return commandService.findByRequestId(requestId)
                .map(log -> ResponseEntity.ok(ApiResponse.success(log)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
