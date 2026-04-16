package com.smartagri.iotaccess.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.iotaccess.domain.entity.DeviceCommandLog;
import com.smartagri.iotaccess.domain.entity.DeviceTelemetry;
import com.smartagri.iotaccess.domain.repository.DeviceCommandLogRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/iot")
public class IotAccessController {

    private final TelemetryIngestionService telemetryIngestionService;
    private final HuaweiIotCommandService commandService;
    private final DeviceCommandLogRepository commandLogRepository;

    @GetMapping("/devices/{deviceId}/latest")
    public ApiResponse<DeviceTelemetry> latest(@PathVariable("deviceId") String deviceId) {
        return ApiResponse.success(telemetryIngestionService.latest(deviceId));
    }

    @GetMapping("/devices/{deviceId}/telemetry")
    public ApiResponse<java.util.List<DeviceTelemetry>> telemetry(
            @PathVariable("deviceId") String deviceId,
            @RequestParam(name = "minutes", defaultValue = "60") int minutes) {
        return ApiResponse.success(telemetryIngestionService.recent(deviceId, minutes));
    }

    @GetMapping("/devices/{deviceId}/status")
    public ApiResponse<Map<String, Object>> status(@PathVariable("deviceId") String deviceId) {
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

    @GetMapping("/devices/{deviceId}/capabilities")
    public ApiResponse<Map<String, Object>> capabilities(@PathVariable("deviceId") String deviceId) {
        DeviceTelemetry latest = telemetryIngestionService.latest(deviceId);
        List<String> sensors = new ArrayList<>();
        List<String> actuators = new ArrayList<>();

        if (latest != null) {
            if (latest.getTemperature() != null) {
                sensors.add("temperature");
            }
            if (latest.getHumidity() != null) {
                sensors.add("humidity");
            }
            if (latest.getLuminance() != null) {
                sensors.add("luminance");
            }
            String rawPayload = latest.getRawPayload() == null ? "" : latest.getRawPayload().toLowerCase();
            if (rawPayload.contains("temperature") && !sensors.contains("temperature")) {
                sensors.add("temperature");
            }
            if (rawPayload.contains("humidity") && !sensors.contains("humidity")) {
                sensors.add("humidity");
            }
            if ((rawPayload.contains("luminance") || rawPayload.contains("light")) && !sensors.contains("luminance")) {
                sensors.add("luminance");
            }
            if (latest.getLedStatus() != null) {
                actuators.add("led");
            }
            if (latest.getMotorStatus() != null) {
                actuators.add("motor");
            }
        }

        List<DeviceCommandLog> recentCommands = commandLogRepository.findTop20ByDeviceIdOrderByCreatedAtDesc(deviceId);
        for (DeviceCommandLog log : recentCommands) {
            String commandType = log.getCommandType() == null ? "" : log.getCommandType().trim().toUpperCase();
            if ("LIGHT_CONTROL".equals(commandType) && !actuators.contains("led")) {
                actuators.add("led");
            }
            if ("MOTOR_CONTROL".equals(commandType) && !actuators.contains("motor")) {
                actuators.add("motor");
            }
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("deviceId", deviceId);
        payload.put("reportTime", latest == null ? null : latest.getReportTime());
        payload.put("sensors", sensors);
        payload.put("actuators", actuators);
        return ApiResponse.success(payload);
    }

    @PostMapping("/commands")
    public ApiResponse<CommandDispatchResponse> sendCommand(@Valid @RequestBody DeviceControlRequest request) {
        return ApiResponse.success(commandService.dispatch(request));
    }

    @PutMapping("/devices/{deviceId}/actuators")
    public ApiResponse<Map<String, CommandDispatchResponse>> controlActuator(
            @PathVariable("deviceId") String deviceId,
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
    public ResponseEntity<ApiResponse<DeviceCommandLog>> queryCommand(@PathVariable("requestId") String requestId) {
        return commandService.findByRequestId(requestId)
                .map(log -> ResponseEntity.ok(ApiResponse.success(log)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
