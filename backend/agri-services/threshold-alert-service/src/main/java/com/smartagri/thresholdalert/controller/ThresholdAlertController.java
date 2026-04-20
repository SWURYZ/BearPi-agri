package com.smartagri.thresholdalert.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.thresholdalert.dto.AlertRecordDto;
import com.smartagri.thresholdalert.dto.ThresholdRuleDto;
import com.smartagri.thresholdalert.dto.ThresholdRuleRequest;
import com.smartagri.thresholdalert.service.ThresholdAlertService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/threshold-alert")
public class ThresholdAlertController {

    private final ThresholdAlertService thresholdAlertService;

    @GetMapping("/rules")
    public ApiResponse<List<ThresholdRuleDto>> listRules() {
        return ApiResponse.success(thresholdAlertService.listRules());
    }

    @PostMapping("/rules")
    public ApiResponse<ThresholdRuleDto> createRule(@Valid @RequestBody ThresholdRuleRequest request) {
        return ApiResponse.success(thresholdAlertService.createRule(request));
    }

    @PutMapping("/rules/{id}")
    public ApiResponse<ThresholdRuleDto> updateRule(
            @PathVariable("id") Long id,
            @Valid @RequestBody ThresholdRuleRequest request
    ) {
        return ApiResponse.success(thresholdAlertService.updateRule(id, request));
    }

    @PatchMapping("/rules/{id}/toggle")
    public ApiResponse<String> toggleRule(@PathVariable("id") Long id, @RequestParam("enabled") boolean enabled) {
        thresholdAlertService.toggleRule(id, enabled);
        return ApiResponse.success("ok");
    }

    @DeleteMapping("/rules/{id}")
    public ApiResponse<String> deleteRule(@PathVariable("id") Long id) {
        thresholdAlertService.deleteRule(id);
        return ApiResponse.success("ok");
    }

    @GetMapping("/records")
    public ApiResponse<List<AlertRecordDto>> listRecords() {
        return ApiResponse.success(thresholdAlertService.listRecords());
    }

    @PostMapping("/check-now")
    public ApiResponse<String> checkNow() {
        thresholdAlertService.runCheckNow();
        return ApiResponse.success("ok");
    }
}
