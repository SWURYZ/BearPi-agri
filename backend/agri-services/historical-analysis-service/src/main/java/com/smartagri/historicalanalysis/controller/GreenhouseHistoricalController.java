package com.smartagri.historicalanalysis.controller;

import com.smartagri.historicalanalysis.dto.RealtimeMetricsResponse;
import com.smartagri.historicalanalysis.dto.SensorHistoryPoint;
import com.smartagri.historicalanalysis.service.GreenhouseHistoricalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/greenhouses")
public class GreenhouseHistoricalController {

    private final GreenhouseHistoricalService historicalService;

    @GetMapping("/{greenhouse}/realtime")
    public ResponseEntity<RealtimeMetricsResponse> realtime(@PathVariable("greenhouse") String greenhouse) {
        String deviceId = historicalService.resolveDeviceId(greenhouse).orElse(null);
        if (deviceId == null) {
            return ResponseEntity.notFound().build();
        }

        RealtimeMetricsResponse response = historicalService.realtime(greenhouse, deviceId);
        if (response == null) {
            return ResponseEntity.ok(new RealtimeMetricsResponse(greenhouse, deviceId, null, null, null, null));
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{greenhouse}/history")
    public ResponseEntity<List<SensorHistoryPoint>> history(
            @PathVariable("greenhouse") String greenhouse,
            @RequestParam("sensor") String sensor,
            @RequestParam(name = "range", defaultValue = "24h") String range,
            @RequestParam(name = "aggregate", defaultValue = "true") boolean aggregate,
            @RequestParam(name = "fixedSlots", defaultValue = "false") boolean fixedSlots) {
        String deviceId = historicalService.resolveDeviceId(greenhouse).orElse(null);
        if (deviceId == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(historicalService.history(deviceId, sensor, range, aggregate, fixedSlots));
    }
}
