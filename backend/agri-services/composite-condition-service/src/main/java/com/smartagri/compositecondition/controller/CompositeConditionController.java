package com.smartagri.compositecondition.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.compositecondition.dto.CompositeRuleRequest;
import com.smartagri.compositecondition.dto.CompositeRuleResponse;
import com.smartagri.compositecondition.dto.LinkageLogResponse;
import com.smartagri.compositecondition.dto.SensorDataRequest;
import com.smartagri.compositecondition.service.CompositeRuleService;
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
@RequestMapping("/api/v1/composite-condition")
public class CompositeConditionController {

    private final CompositeRuleService ruleService;

    // ---- 规则管理 ----

    /** 查询所有规则 */
    @GetMapping("/rules")
    public ApiResponse<List<CompositeRuleResponse>> listRules() {
        return ApiResponse.success(ruleService.listAll());
    }

    /** 查询单条规则 */
    @GetMapping("/rules/{id}")
    public ApiResponse<CompositeRuleResponse> getRule(@PathVariable("id") Long id) {
        return ApiResponse.success(ruleService.getById(id));
    }

    /** 创建复合条件规则 */
    @PostMapping("/rules")
    public ApiResponse<CompositeRuleResponse> createRule(@Valid @RequestBody CompositeRuleRequest request) {
        return ApiResponse.success(ruleService.create(request));
    }

    /** 更新规则（全量替换） */
    @PutMapping("/rules/{id}")
    public ApiResponse<CompositeRuleResponse> updateRule(
            @PathVariable("id") Long id,
            @Valid @RequestBody CompositeRuleRequest request) {
        return ApiResponse.success(ruleService.update(id, request));
    }

    /** 删除规则 */
    @DeleteMapping("/rules/{id}")
    public ApiResponse<String> deleteRule(@PathVariable("id") Long id) {
        ruleService.delete(id);
        return ApiResponse.success("规则已删除");
    }

    /** 启用/禁用规则 */
    @PatchMapping("/rules/{id}/enabled")
    public ApiResponse<CompositeRuleResponse> toggleEnabled(
            @PathVariable("id") Long id,
            @RequestParam("value") boolean enabled) {
        return ApiResponse.success(ruleService.toggleEnabled(id, enabled));
    }

    /** 启用/禁用规则（POST 兼容入口，便于前端跨域场景使用） */
    @PostMapping("/rules/{id}/enabled")
    public ApiResponse<CompositeRuleResponse> toggleEnabledByPost(
            @PathVariable("id") Long id,
            @RequestParam("value") boolean enabled) {
        return ApiResponse.success(ruleService.toggleEnabled(id, enabled));
    }

    // ---- 传感器数据接入 ----

    /**
     * 接收最新传感器数据（由 IoT 接入服务或内部系统上报，触发后台实时匹配）
     */
    @PostMapping("/sensor-data")
    public ApiResponse<String> ingestSensorData(@Valid @RequestBody SensorDataRequest request) {
        ruleService.ingestSensorData(request);
        return ApiResponse.success("数据已更新");
    }

    // ---- 联动日志 ----

    /** 查询指定规则的联动操作日志 */
    @GetMapping("/rules/{id}/logs")
    public ApiResponse<List<LinkageLogResponse>> getLogsByRule(@PathVariable("id") Long id) {
        return ApiResponse.success(ruleService.getLogs(id));
    }

    /** 查询指定目标设备的联动操作日志 */
    @GetMapping("/logs/device/{deviceId}")
    public ApiResponse<List<LinkageLogResponse>> getLogsByDevice(@PathVariable("deviceId") String deviceId) {
        return ApiResponse.success(ruleService.getLogsByDevice(deviceId));
    }
}
