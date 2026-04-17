package com.smartagri.thresholdalert.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.thresholdalert.dto.IngestResultResponse;
import com.smartagri.thresholdalert.dto.SensorReadingIngestRequest;
import com.smartagri.thresholdalert.dto.ThresholdAutoPollConfigRequest;
import com.smartagri.thresholdalert.dto.ThresholdAutoPollConfigResponse;
import com.smartagri.thresholdalert.dto.ThresholdAlertRecordResponse;
import com.smartagri.thresholdalert.dto.ThresholdRuleRequest;
import com.smartagri.thresholdalert.dto.ThresholdRuleResponse;
import com.smartagri.thresholdalert.service.ThresholdAutoPollConfigService;
import com.smartagri.thresholdalert.service.ThresholdAlertService;
import com.smartagri.thresholdalert.service.ThresholdRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/threshold-alert")
public class ThresholdAlertController {

    private static final DateTimeFormatter FILE_TIME_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ThresholdRuleService thresholdRuleService;
    private final ThresholdAlertService thresholdAlertService;
    private final ThresholdAutoPollConfigService autoPollConfigService;

    @PostMapping("/rules")
    public ApiResponse<ThresholdRuleResponse> saveRule(@Valid @RequestBody ThresholdRuleRequest request) {
        return ApiResponse.success(thresholdRuleService.upsert(request));
    }

    @GetMapping("/rules")
    public ApiResponse<List<ThresholdRuleResponse>> listRules() {
        return ApiResponse.success(thresholdRuleService.listAll());
    }

    @GetMapping("/auto-poll-config")
    public ApiResponse<ThresholdAutoPollConfigResponse> getAutoPollConfig() {
        return ApiResponse.success(autoPollConfigService.getConfig());
    }

    @PostMapping("/auto-poll-config")
    public ApiResponse<ThresholdAutoPollConfigResponse> updateAutoPollConfig(
            @Valid @RequestBody ThresholdAutoPollConfigRequest request) {
        return ApiResponse.success(autoPollConfigService.updateConfig(request));
    }

    @GetMapping("/rules/device/{deviceId}")
    public ApiResponse<ThresholdRuleResponse> getRuleByDevice(@PathVariable("deviceId") String deviceId) {
        try {
            return ApiResponse.success(thresholdRuleService.getByDeviceId(deviceId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.failure(404, e.getMessage(), null);
        }
    }

    @PostMapping("/readings/ingest")
    public ApiResponse<IngestResultResponse> ingestReading(@Valid @RequestBody SensorReadingIngestRequest request) {
        try {
            return ApiResponse.success(thresholdAlertService.ingest(request));
        } catch (IllegalArgumentException e) {
            return ApiResponse.failure(400, e.getMessage(), null);
        }
    }

    @GetMapping("/alerts")
    public ApiResponse<List<ThresholdAlertRecordResponse>> listAlerts(
            @RequestParam(value = "deviceId", required = false) String deviceId,
            @RequestParam(value = "startTime", required = false) String startTime,
            @RequestParam(value = "endTime", required = false) String endTime) {
        try {
            return ApiResponse.success(thresholdAlertService.listAlerts(deviceId, startTime, endTime));
        } catch (IllegalArgumentException e) {
            return ApiResponse.failure(400, e.getMessage(), null);
        }
    }

    @PostMapping("/alerts/{id}/process")
    public ApiResponse<Boolean> processAlert(@PathVariable("id") Long alertId) {
        try {
            thresholdAlertService.processAlert(alertId);
            return ApiResponse.success(true);
        } catch (IllegalArgumentException e) {
            return ApiResponse.failure(404, e.getMessage(), false);
        }
    }

    @PostMapping("/alerts/process-all")
    public ApiResponse<Integer> processAllAlerts() {
        return ApiResponse.success(thresholdAlertService.processAllAlerts());
    }

    @GetMapping(value = "/alerts/export", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<byte[]> exportAlerts(
            @RequestParam(value = "deviceId", required = false) String deviceId,
            @RequestParam(value = "startTime", required = false) String startTime,
            @RequestParam(value = "endTime", required = false) String endTime) {
        String csv = thresholdAlertService.exportCsv(deviceId, startTime, endTime);
        byte[] utf8Bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] csvBytes = csv.getBytes(StandardCharsets.UTF_8);
        byte[] body = new byte[utf8Bom.length + csvBytes.length];
        System.arraycopy(utf8Bom, 0, body, 0, utf8Bom.length);
        System.arraycopy(csvBytes, 0, body, utf8Bom.length, csvBytes.length);
        String fileName = "threshold-alert-audit-" + LocalDateTime.now().format(FILE_TIME_FMT) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + fileName)
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(body);
    }
}
