package com.smartagri.thresholdalert.service;

import com.smartagri.thresholdalert.config.ThresholdAlertProperties;
import com.smartagri.thresholdalert.dto.AlertRecordDto;
import com.smartagri.thresholdalert.dto.ThresholdRuleDto;
import com.smartagri.thresholdalert.dto.ThresholdRuleRequest;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class ThresholdAlertService {

    private static final int MAX_ALERT_RECORDS = 500;

    private final ThresholdAlertProperties properties;

    private final AtomicLong ruleIdGen = new AtomicLong(0);
    private final AtomicLong recordIdGen = new AtomicLong(0);
    private final Map<Long, RuleEntity> rules = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<AlertRecordDto> records = new CopyOnWriteArrayList<>();
    private final Map<String, Boolean> blinkingLedState = new ConcurrentHashMap<>();
    private final RestTemplate restTemplate = new RestTemplate();

    @PostConstruct
    public void initDefaultRules() {
        // 默认规则保持禁用：避免启动后自动抢占 LED (会与用户手动/定时控制冲突,
        // 造成"实时检测中灯光被自动关闭"的现象). 如需启用,由用户在前端打开.
        createRule(new ThresholdRuleRequest(
                "69d75b1d7f2e6c302f654fea_20031104",
                "temp",
                "ABOVE",
                30.0,
                false
        ));
    }

    public List<ThresholdRuleDto> listRules() {
        return rules.values().stream()
                .sorted(Comparator.comparing(RuleEntity::id))
                .map(this::toDto)
                .toList();
    }

    public ThresholdRuleDto createRule(ThresholdRuleRequest request) {
        validateRequest(request);
        long id = ruleIdGen.incrementAndGet();
        LocalDateTime now = LocalDateTime.now();
        RuleEntity entity = new RuleEntity(
                id,
                request.deviceId().trim(),
                normalizeMetric(request.metric()),
                normalizeOperator(request.operator()),
                request.threshold(),
                request.enabled() == null || request.enabled(),
                now,
                now
        );
        rules.put(id, entity);
        return toDto(entity);
    }

    public ThresholdRuleDto updateRule(Long id, ThresholdRuleRequest request) {
        validateRequest(request);
        RuleEntity old = rules.get(id);
        if (old == null) {
            throw new IllegalArgumentException("规则不存在: " + id);
        }
        RuleEntity next = new RuleEntity(
                old.id(),
                request.deviceId().trim(),
                normalizeMetric(request.metric()),
                normalizeOperator(request.operator()),
                request.threshold(),
                request.enabled() == null ? old.enabled() : request.enabled(),
                old.createdAt(),
                LocalDateTime.now()
        );
        rules.put(id, next);
        return toDto(next);
    }

    public void toggleRule(Long id, boolean enabled) {
        RuleEntity old = rules.get(id);
        if (old == null) {
            throw new IllegalArgumentException("规则不存在: " + id);
        }
        rules.put(id, new RuleEntity(
                old.id(),
                old.deviceId(),
                old.metric(),
                old.operator(),
                old.threshold(),
                enabled,
                old.createdAt(),
                LocalDateTime.now()
        ));
    }

    public void deleteRule(Long id) {
        RuleEntity removed = rules.remove(id);
        if (removed == null) {
            throw new IllegalArgumentException("规则不存在: " + id);
        }
        // 规则删除时不再强制下发 LED OFF,避免覆盖用户当前开关状态.
        blinkingLedState.remove(removed.deviceId());
    }

    public List<AlertRecordDto> listRecords() {
        List<AlertRecordDto> result = new ArrayList<>(records);
        result.sort(Comparator.comparing(AlertRecordDto::alertedAt).reversed());
        return result;
    }

    public void runCheckNow() {
        evaluateAndBlink();
    }

    @Scheduled(fixedDelayString = "${threshold-alert.poll-interval-ms:5000}")
    public void evaluateAndBlink() {
        if (rules.isEmpty()) {
            return;
        }

        Set<String> breachedDevices = new HashSet<>();

        for (RuleEntity rule : rules.values()) {
            if (!rule.enabled()) {
                continue;
            }

            Double currentValue = fetchMetricValue(rule.deviceId(), rule.metric());
            if (currentValue == null) {
                continue;
            }

            boolean breached = isBreached(currentValue, rule.operator(), rule.threshold());
            if (!breached) {
                continue;
            }

            breachedDevices.add(rule.deviceId());
            appendRecord(rule, currentValue);
        }

        // 注意: 不再通过下发 LIGHT_CONTROL 指令闪烁 LED.
        // 该副作用会覆盖用户手动操作与定时规则,造成"设备自动关闭"的体感问题.
        // 阈值告警仅以记录 + 前端高亮形式呈现.
        // blinkLedsForBreachedDevices(breachedDevices);
    }

    private void validateRequest(ThresholdRuleRequest request) {
        if (request.deviceId() == null || request.deviceId().isBlank()) {
            throw new IllegalArgumentException("deviceId 不能为空");
        }
        normalizeMetric(request.metric());
        normalizeOperator(request.operator());
        if (request.threshold() == null || !Double.isFinite(request.threshold()) || request.threshold() <= 0) {
            throw new IllegalArgumentException("threshold 必须为正数");
        }
    }

    private String normalizeMetric(String metric) {
        String normalized = metric == null ? "" : metric.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "temp", "humidity", "light", "co2" -> normalized;
            default -> throw new IllegalArgumentException("不支持的参数: " + metric + "，仅支持 temp/humidity/light/co2");
        };
    }

    private String normalizeOperator(String operator) {
        String normalized = operator == null ? "" : operator.trim().toUpperCase(Locale.ROOT);
        if (!"ABOVE".equals(normalized) && !"BELOW".equals(normalized)) {
            throw new IllegalArgumentException("operator 仅支持 ABOVE 或 BELOW");
        }
        return normalized;
    }

    private ThresholdRuleDto toDto(RuleEntity entity) {
        return new ThresholdRuleDto(
                entity.id(),
                entity.deviceId(),
                entity.metric(),
                entity.operator(),
                entity.threshold(),
                entity.enabled(),
                entity.createdAt(),
                entity.updatedAt()
        );
    }

    private Double fetchMetricValue(String deviceId, String metric) {
        String runtimeDeviceId = resolveRuntimeDeviceId(deviceId);
        String url = properties.iotStatusBaseUrl() + "/devices/" + runtimeDeviceId + "/status";
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            Map body = response.getBody();
            if (body == null) {
                return null;
            }
            Object dataObj = body.get("data");
            if (!(dataObj instanceof Map<?, ?> data)) {
                return null;
            }

            Object value = switch (metric) {
                case "temp" -> data.get("temperature");
                case "humidity" -> data.get("humidity");
                case "light" -> data.get("luminance");
                case "co2" -> data.get("co2");
                default -> null;
            };

            if (!(value instanceof Number number)) {
                return null;
            }
            return number.doubleValue();
        } catch (Exception ex) {
            log.debug("获取设备状态失败, deviceId={}, runtimeDeviceId={}, metric={}, error={}", deviceId, runtimeDeviceId, metric, ex.getMessage());
            return null;
        }
    }

    private boolean isBreached(double currentValue, String operator, double threshold) {
        return "ABOVE".equals(operator)
                ? currentValue > threshold
                : currentValue < threshold;
    }

    private void appendRecord(RuleEntity rule, Double currentValue) {
        String opText = "ABOVE".equals(rule.operator()) ? "超过" : "低于";
        String message = String.format(
                Locale.ROOT,
                "参数%s%s阈值，当前值=%.2f，阈值=%.2f",
                rule.metric(),
                opText,
                currentValue,
                rule.threshold()
        );

        AlertRecordDto record = new AlertRecordDto(
                recordIdGen.incrementAndGet(),
                rule.id(),
                rule.deviceId(),
                rule.metric(),
                rule.operator(),
                rule.threshold(),
                currentValue,
                message,
                LocalDateTime.now()
        );

        records.add(record);
        trimRecordsIfNeeded();
    }

    private void trimRecordsIfNeeded() {
        while (records.size() > MAX_ALERT_RECORDS) {
            records.remove(0);
        }
    }

    private void blinkLedsForBreachedDevices(Set<String> breachedDevices) {
        // For each breached device: toggle ON/OFF every 5s => LED blinks every cycle.
        for (String deviceId : breachedDevices) {
            boolean nextOn = !blinkingLedState.getOrDefault(deviceId, false);
            sendLightCommand(deviceId, nextOn ? "ON" : "OFF");
            blinkingLedState.put(deviceId, nextOn);
        }

        // If device no longer breaches: force OFF once and stop blinking state.
        Set<String> trackedDevices = new HashSet<>(blinkingLedState.keySet());
        for (String deviceId : trackedDevices) {
            if (breachedDevices.contains(deviceId)) {
                continue;
            }
            sendLightCommand(deviceId, "OFF");
            blinkingLedState.remove(deviceId);
        }
    }

    private void stopBlinkingForDeviceIfNoActiveRule(String deviceId) {
        boolean hasActiveRule = rules.values().stream()
                .anyMatch(rule -> Objects.equals(rule.deviceId(), deviceId) && rule.enabled());
        if (!hasActiveRule) {
            sendLightCommand(deviceId, "OFF");
            blinkingLedState.remove(deviceId);
        }
    }

    private void sendLightCommand(String deviceId, String action) {
        String runtimeDeviceId = resolveRuntimeDeviceId(deviceId);
        String url = properties.deviceControlBaseUrl() + "/manual";
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("deviceId", runtimeDeviceId);
        payload.put("commandType", "LIGHT_CONTROL");
        payload.put("action", action);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(payload, headers), Map.class);
        } catch (Exception ex) {
            log.warn("下发LED命令失败, deviceId={}, runtimeDeviceId={}, action={}, error={}", deviceId, runtimeDeviceId, action, ex.getMessage());
        }
    }

    private String resolveRuntimeDeviceId(String deviceId) {
        if (deviceId != null && deviceId.startsWith("DEV-GH") && properties.runtimeDeviceId() != null && !properties.runtimeDeviceId().isBlank()) {
            return properties.runtimeDeviceId();
        }
        return deviceId;
    }

    private record RuleEntity(
            Long id,
            String deviceId,
            String metric,
            String operator,
            Double threshold,
            boolean enabled,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }
}
