package com.smartagri.compositecondition.service;

import com.smartagri.compositecondition.config.CompositeConditionProperties;
import com.smartagri.compositecondition.domain.entity.LinkageActionLog;
import com.smartagri.compositecondition.domain.repository.LinkageActionLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huaweicloud.sdk.core.auth.AbstractCredentials;
import com.huaweicloud.sdk.core.auth.BasicCredentials;
import com.huaweicloud.sdk.core.exception.ServiceResponseException;
import com.huaweicloud.sdk.core.region.Region;
import com.huaweicloud.sdk.iotda.v5.IoTDAClient;
import com.huaweicloud.sdk.iotda.v5.model.CreateMessageRequest;
import com.huaweicloud.sdk.iotda.v5.model.CreateMessageResponse;
import com.huaweicloud.sdk.iotda.v5.model.DeviceMessageRequest;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;

/**
 * 向华为云 IoTDA 平台下发指令，并记录联动日志
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LinkageDispatchService {

    private final CompositeConditionProperties properties;
    private final LinkageActionLogRepository logRepository;
    private final ObjectMapper objectMapper;

    private IoTDAClient client;

    @PostConstruct
    void init() {
        if (!properties.isCommandEnabled()) {
            return;
        }
        if (!StringUtils.hasText(properties.getAk())
                || !StringUtils.hasText(properties.getSk())
                || !StringUtils.hasText(properties.getProjectId())) {
            return;
        }

        BasicCredentials credentials = new BasicCredentials()
                .withDerivedPredicate(AbstractCredentials.DEFAULT_DERIVED_PREDICATE)
                .withAk(properties.getAk().trim())
                .withSk(properties.getSk().trim())
                .withProjectId(properties.getProjectId().trim());

        this.client = IoTDAClient.newBuilder()
                .withCredential(credentials)
                .withRegion(resolveRegion())
                .build();
    }

    /**
     * 下发联动指令并写入操作日志
     */
    public void dispatch(Long ruleId, String ruleName, String conditionSnapshot,
                         String targetDeviceId, String commandType, String commandAction) {

        LinkageActionLog actionLog = new LinkageActionLog();
        actionLog.setRuleId(ruleId);
        actionLog.setRuleName(ruleName);
        actionLog.setConditionSnapshot(conditionSnapshot);
        actionLog.setTargetDeviceId(targetDeviceId);
        actionLog.setCommandType(commandType);
        actionLog.setCommandAction(commandAction);

        if (!properties.isCommandEnabled() || client == null) {
            actionLog.setDispatchStatus("SKIPPED");
            actionLog.setErrorMessage("Command dispatch disabled or IoT client not initialized");
            logRepository.save(actionLog);
            log.info("[联动] 指令跳过, ruleId={}, targetDevice={}", ruleId, targetDeviceId);
            return;
        }

        String effectiveCommandType = normalizeCommandType(commandType, ruleName);
        Map<String, Object> payload = buildPayload(effectiveCommandType, commandAction);
        DeviceMessageRequest body = new DeviceMessageRequest();
        body.setMessage(payload);

        CreateMessageRequest cloudRequest = new CreateMessageRequest()
                .withDeviceId(targetDeviceId)
                .withBody(body);

        try {
            CreateMessageResponse response = client.createMessage(cloudRequest);
            actionLog.setDispatchStatus("SENT");
            actionLog.setCloudMessageId(response.getMessageId());
            logRepository.save(actionLog);
            log.info("[联动] 指令已下发, ruleId={}, targetDevice={}, messageId={}",
                    ruleId, targetDeviceId, response.getMessageId());
        } catch (ServiceResponseException ex) {
            actionLog.setDispatchStatus("FAILED");
            actionLog.setErrorMessage("[" + ex.getErrorCode() + "] " + ex.getErrorMsg());
            logRepository.save(actionLog);
            log.error("[联动] 指令下发失败, ruleId={}, error={}", ruleId, actionLog.getErrorMessage());
        } catch (Exception ex) {
            actionLog.setDispatchStatus("FAILED");
            actionLog.setErrorMessage(ex.getClass().getSimpleName() + ": " + ex.getMessage());
            logRepository.save(actionLog);
            log.error("[联动] 指令下发异常, ruleId={}", ruleId, ex);
        }
    }

    public String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return String.valueOf(value);
        }
    }

    private Map<String, Object> buildPayload(String commandType, String action) {
        Map<String, Object> payload = new HashMap<>();
        String normalizedType = commandType == null ? "" : commandType.trim().toUpperCase();
        switch (normalizedType) {
            case "LIGHT_CONTROL" -> payload.put("led", action);
            case "MOTOR_CONTROL" -> payload.put("motor", action);
            default -> {
                payload.put("commandType", commandType);
                payload.put("action", action);
            }
        }
        return payload;
    }

    private String normalizeCommandType(String commandType, String ruleName) {
        String raw = commandType == null ? "" : commandType.trim();
        String normalized = raw.toUpperCase();
        if ("LIGHT_CONTROL".equals(normalized) || "MOTOR_CONTROL".equals(normalized)) {
            if ("LIGHT_CONTROL".equals(normalized) && isIrrigationRule(ruleName)) {
                return "MOTOR_CONTROL";
            }
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

        if (isIrrigationRule(ruleName)) {
            return "MOTOR_CONTROL";
        }
        return raw;
    }

    private boolean isIrrigationRule(String ruleName) {
        if (!StringUtils.hasText(ruleName)) {
            return false;
        }
        String text = ruleName.toLowerCase();
        return text.contains("浇水")
                || text.contains("灌溉")
                || text.contains("水泵")
                || text.contains("马达")
                || text.contains("电机");
    }

    private Region resolveRegion() {
        String region = StringUtils.hasText(properties.getRegion())
                ? properties.getRegion().trim() : "cn-north-4";
        if (StringUtils.hasText(properties.getEndpoint())) {
            return new Region(region, properties.getEndpoint().trim());
        }
        return new Region(region,
                "https://iotda.%s.myhuaweicloud.com".formatted(region));
    }
}
