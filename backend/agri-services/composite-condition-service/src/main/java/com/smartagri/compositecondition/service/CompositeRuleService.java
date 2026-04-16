package com.smartagri.compositecondition.service;

import com.smartagri.compositecondition.domain.entity.CompositeRule;
import com.smartagri.compositecondition.domain.entity.RuleCondition;
import com.smartagri.compositecondition.domain.entity.SensorLatestData;
import com.smartagri.compositecondition.domain.repository.CompositeRuleRepository;
import com.smartagri.compositecondition.domain.repository.LinkageActionLogRepository;
import com.smartagri.compositecondition.domain.repository.SensorLatestDataRepository;
import com.smartagri.compositecondition.dto.CompositeRuleRequest;
import com.smartagri.compositecondition.dto.CompositeRuleResponse;
import com.smartagri.compositecondition.dto.LinkageLogResponse;
import com.smartagri.compositecondition.dto.RuleConditionResponse;
import com.smartagri.compositecondition.dto.SensorDataRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompositeRuleService {

    private final CompositeRuleRepository ruleRepository;
    private final SensorLatestDataRepository sensorDataRepository;
    private final LinkageActionLogRepository logRepository;
    private final LinkageDispatchService dispatchService;

    // ---- Rule CRUD ----

    @Transactional(readOnly = true)
    public List<CompositeRuleResponse> listAll() {
        return ruleRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CompositeRuleResponse getById(Long id) {
        return ruleRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("规则不存在: " + id));
    }

    @Transactional
    public CompositeRuleResponse create(CompositeRuleRequest request) {
        CompositeRule rule = new CompositeRule();
        applyRequest(rule, request);
        return toResponse(ruleRepository.save(rule));
    }

    @Transactional
    public CompositeRuleResponse update(Long id, CompositeRuleRequest request) {
        CompositeRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("规则不存在: " + id));
        rule.getConditions().clear();
        applyRequest(rule, request);
        return toResponse(ruleRepository.save(rule));
    }

    @Transactional
    public void delete(Long id) {
        CompositeRule rule = ruleRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("规则不存在: " + id));
        // 删除规则时立即下发关闭指令，避免设备保持在之前的开启状态。
        dispatchService.dispatch(
            rule.getId(),
            rule.getName() + "[DELETE_OFF]",
            "{\"reason\":\"rule_deleted\"}",
            rule.getTargetDeviceId(),
            rule.getCommandType(),
            "OFF");
        ruleRepository.delete(rule);
    }

    @Transactional
    public CompositeRuleResponse toggleEnabled(Long id, boolean enabled) {
        CompositeRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("规则不存在: " + id));
        rule.setEnabled(enabled);
        CompositeRule saved = ruleRepository.save(rule);
        if (!enabled) {
            // 禁用后立即下发关闭指令，避免用户感知“禁用了但灯还亮”。
            dispatchService.dispatch(
                    saved.getId(),
                    saved.getName() + "[DISABLE_OFF]",
                    "{\"reason\":\"rule_disabled\"}",
                    saved.getTargetDeviceId(),
                    saved.getCommandType(),
                    "OFF");
        }
        return toResponse(saved);
    }

    // ---- Sensor data ingestion ----

    @Transactional
    public void ingestSensorData(SensorDataRequest request) {
        String pk = request.deviceId() + "#" + request.metric();
        SensorLatestData data = sensorDataRepository.findById(pk)
                .orElseGet(() -> {
                    SensorLatestData d = new SensorLatestData();
                    d.setPk(pk);
                    d.setDeviceId(request.deviceId());
                    d.setMetric(request.metric());
                    return d;
                });
        data.setValue(request.value());
        sensorDataRepository.save(data);
        log.debug("[传感器数据] device={}, metric={}, value={}", request.deviceId(), request.metric(), request.value());
    }

    // ---- Logs ----

    public List<LinkageLogResponse> getLogs(Long ruleId) {
        return logRepository.findByRuleIdOrderByTriggeredAtDesc(ruleId).stream()
                .map(l -> new LinkageLogResponse(
                        l.getId(), l.getRuleId(), l.getRuleName(),
                        l.getConditionSnapshot(), l.getTargetDeviceId(),
                        l.getCommandType(), l.getCommandAction(),
                        l.getDispatchStatus(), l.getCloudMessageId(),
                        l.getErrorMessage(), l.getTriggeredAt()))
                .collect(Collectors.toList());
    }

    public List<LinkageLogResponse> getLogsByDevice(String deviceId) {
        return logRepository.findByTargetDeviceIdOrderByTriggeredAtDesc(deviceId).stream()
                .map(l -> new LinkageLogResponse(
                        l.getId(), l.getRuleId(), l.getRuleName(),
                        l.getConditionSnapshot(), l.getTargetDeviceId(),
                        l.getCommandType(), l.getCommandAction(),
                        l.getDispatchStatus(), l.getCloudMessageId(),
                        l.getErrorMessage(), l.getTriggeredAt()))
                .collect(Collectors.toList());
    }

    // ---- Mapping ----

    private void applyRequest(CompositeRule rule, CompositeRuleRequest request) {
        rule.setName(request.name());
        rule.setDescription(request.description());
        rule.setLogicOperator(request.logicOperator() != null ? request.logicOperator() : "AND");
        rule.setEnabled(request.enabled());
        rule.setTargetDeviceId(request.targetDeviceId());
        rule.setCommandType(normalizeCommandType(request.commandType(), request.name(), request.description()));
        rule.setCommandAction(request.commandAction());

        if (request.conditions() != null) {
            request.conditions().forEach(cr -> {
                RuleCondition condition = new RuleCondition();
                condition.setRule(rule);
                condition.setSensorMetric(cr.sensorMetric());
                condition.setSourceDeviceId(cr.sourceDeviceId());
                condition.setOperator(cr.operator());
                condition.setThreshold(cr.threshold());
                rule.getConditions().add(condition);
            });
        }
    }

    private CompositeRuleResponse toResponse(CompositeRule rule) {
        List<RuleConditionResponse> conditionResponses = rule.getConditions().stream()
                .map(c -> new RuleConditionResponse(
                        c.getId(), c.getSensorMetric(), c.getSourceDeviceId(),
                        c.getOperator(), c.getThreshold()))
                .collect(Collectors.toList());

        return new CompositeRuleResponse(
                rule.getId(),
                rule.getName(),
                rule.getDescription(),
                rule.getLogicOperator(),
                rule.isEnabled(),
                rule.getTargetDeviceId(),
                rule.getCommandType(),
                rule.getCommandAction(),
                conditionResponses,
                rule.getCreatedAt(),
                rule.getUpdatedAt());
    }

    private String normalizeCommandType(String commandType, String ruleName, String description) {
        String raw = commandType == null ? "" : commandType.trim();
        String normalized = raw.toUpperCase();
        if ("LIGHT_CONTROL".equals(normalized) || "MOTOR_CONTROL".equals(normalized)) {
            return normalized;
        }

        if ("补光灯".equals(raw) || "LIGHT".equals(normalized)) {
            return "LIGHT_CONTROL";
        }
        if ("灌溉水泵".equals(raw)
                || "水泵".equals(raw)
                || "电机".equals(raw)
                || "马达".equals(raw)
                || "MOTOR".equals(normalized)
                || "PUMP".equals(normalized)) {
            return "MOTOR_CONTROL";
        }

        String text = ((ruleName == null ? "" : ruleName) + " " + (description == null ? "" : description)).toLowerCase();
        if (text.contains("浇水") || text.contains("灌溉") || text.contains("水泵") || text.contains("马达") || text.contains("电机")) {
            return "MOTOR_CONTROL";
        }
        if (text.contains("补光") || text.contains("灯")) {
            return "LIGHT_CONTROL";
        }

        return raw;
    }
}
