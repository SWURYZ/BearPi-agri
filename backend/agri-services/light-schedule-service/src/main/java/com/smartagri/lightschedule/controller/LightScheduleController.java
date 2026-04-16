package com.smartagri.lightschedule.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.lightschedule.domain.entity.ScheduleExecutionLog;
import com.smartagri.lightschedule.dto.ScheduleRuleRequest;
import com.smartagri.lightschedule.dto.ScheduleRuleResponse;
import com.smartagri.lightschedule.service.ScheduleRuleService;
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
@RequestMapping("/api/v1/light-schedule")
public class LightScheduleController {

    private final ScheduleRuleService scheduleRuleService;

    /**
     * 查询所有定时规则
     */
    @GetMapping("/rules")
    public ApiResponse<List<ScheduleRuleResponse>> listRules() {
        return ApiResponse.success(scheduleRuleService.listAll());
    }

    /**
     * 查询指定设备的定时规则
     */
    @GetMapping("/rules/device/{deviceId}")
    public ApiResponse<List<ScheduleRuleResponse>> listByDevice(@PathVariable("deviceId") String deviceId) {
        return ApiResponse.success(scheduleRuleService.listByDevice(deviceId));
    }

    /**
     * 创建定时规则
     */
    @PostMapping("/rules")
    public ApiResponse<ScheduleRuleResponse> createRule(@Valid @RequestBody ScheduleRuleRequest request) {
        try {
            return ApiResponse.success(scheduleRuleService.create(request));
        } catch (IllegalArgumentException e) {
            return ApiResponse.failure(409, e.getMessage(), null);
        }
    }

    /**
     * 更新定时规则
     */
    @PutMapping("/rules/{id}")
    public ApiResponse<ScheduleRuleResponse> updateRule(@PathVariable("id") Long id,
                                                        @Valid @RequestBody ScheduleRuleRequest request) {
        return ApiResponse.success(scheduleRuleService.update(id, request));
    }

    /**
     * 启用/禁用定时规则
     */
    @PatchMapping("/rules/{id}/toggle")
    public ApiResponse<String> toggleRule(@PathVariable("id") Long id,
                                          @RequestParam("enabled") boolean enabled) {
        scheduleRuleService.toggleEnabled(id, enabled);
        return ApiResponse.success(enabled ? "规则已启用" : "规则已禁用");
    }

    /**
     * 删除定时规则
     */
    @DeleteMapping("/rules/{id}")
    public ApiResponse<String> deleteRule(@PathVariable("id") Long id) {
        scheduleRuleService.delete(id);
        return ApiResponse.success("规则已删除");
    }

    /**
     * 查询定时规则的执行日志
     */
    @GetMapping("/rules/{ruleId}/logs")
    public ApiResponse<List<ScheduleExecutionLog>> executionLogs(@PathVariable("ruleId") Long ruleId) {
        return ApiResponse.success(scheduleRuleService.getExecutionLogs(ruleId));
    }
}
