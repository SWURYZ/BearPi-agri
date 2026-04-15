package com.smartagri.iotaccess.greenhouse;

import com.smartagri.iotaccess.domain.entity.DeviceTelemetry;
import com.smartagri.iotaccess.service.TelemetryIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/greenhouses")
public class GreenhouseRealtimeController {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final GreenhouseBindingService greenhouseBindingService;
    private final TelemetryIngestionService telemetryIngestionService;

    @GetMapping("/{greenhouse}/realtime")
    public ResponseEntity<Map<String, Object>> realtime(@PathVariable("greenhouse") String greenhouse) {
        String deviceId = greenhouseBindingService.resolveDeviceId(greenhouse).orElse(null);
        if (deviceId == null) {
            return ResponseEntity.notFound().build();
        }

        DeviceTelemetry latest = telemetryIngestionService.latest(deviceId);
        if (latest == null) {
            return ResponseEntity.ok(Map.of());
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("greenhouse", greenhouse);
        payload.put("deviceId", deviceId);
        payload.put("temp", latest.getTemperature());
        payload.put("humidity", latest.getHumidity());
        payload.put("light", latest.getLuminance());
        payload.put("timestamp", latest.getReportTime());
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/{greenhouse}/history")
    public ResponseEntity<List<Map<String, Object>>> history(
            @PathVariable("greenhouse") String greenhouse,
            @RequestParam("sensor") String sensor,
            @RequestParam(name = "range", defaultValue = "24h") String range) {
        String deviceId = greenhouseBindingService.resolveDeviceId(greenhouse).orElse(null);
        if (deviceId == null) {
            return ResponseEntity.notFound().build();
        }

        int minutes = parseRangeToMinutes(range);
        List<DeviceTelemetry> telemetryList = telemetryIngestionService.recent(deviceId, minutes);
        List<Map<String, Object>> result = new ArrayList<>();

        for (DeviceTelemetry telemetry : telemetryList) {
            Double value = selectSensorValue(sensor, telemetry);
            if (value == null) {
                continue;
            }
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("time", telemetry.getReportTime().format(TIME_FORMATTER));
            point.put("timestamp", telemetry.getReportTime());
            point.put("value", value);
            result.add(point);
        }

        return ResponseEntity.ok(result);
    }

    private int parseRangeToMinutes(String range) {
        return switch (range) {
            case "24h" -> 24 * 60;
            case "72h" -> 72 * 60;
            case "168h" -> 168 * 60;
            case "720h" -> 720 * 60;
            default -> 24 * 60;
        };
    }

    private Double selectSensorValue(String sensor, DeviceTelemetry telemetry) {
        return switch (sensor) {
            case "temp" -> telemetry.getTemperature();
            case "humidity" -> telemetry.getHumidity();
            case "light" -> telemetry.getLuminance();
            default -> null;
        };
    }
}
