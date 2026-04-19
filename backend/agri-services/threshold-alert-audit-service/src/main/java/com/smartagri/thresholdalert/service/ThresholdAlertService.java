package com.smartagri.thresholdalert.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartagri.thresholdalert.domain.entity.DeviceThresholdRule;
import com.smartagri.thresholdalert.domain.entity.ThresholdAlertRecord;
import com.smartagri.thresholdalert.domain.repository.DeviceThresholdRuleRepository;
import com.smartagri.thresholdalert.domain.repository.ThresholdAlertRecordRepository;
import com.smartagri.thresholdalert.dto.IngestResultResponse;
import com.smartagri.thresholdalert.dto.SensorReadingIngestRequest;
import com.smartagri.thresholdalert.dto.ThresholdAlertRecordResponse;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class ThresholdAlertService {

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final DeviceThresholdRuleRepository ruleRepository;
    private final ThresholdAlertRecordRepository alertRecordRepository;
    private final ObjectMapper objectMapper;

    @Value("${threshold-alert.sound-alarm.enabled:true}")
    private boolean soundAlarmEnabled;

    @Value("${threshold-alert.sound-alarm.iot-command-url:http://localhost:8082/api/v1/iot/commands}")
    private String iotCommandUrl;

    @Value("${threshold-alert.sound-alarm.command-type:LIGHT_CONTROL}")
    private String soundCommandType;

    @Value("${threshold-alert.sound-alarm.param-key:Light}")
    private String soundParamKey;

    @Value("${threshold-alert.sound-alarm.param-value:ON}")
    private String soundParamValue;

    @Value("${threshold-alert.sound-alarm.param-off-value:OFF}")
    private String soundParamOffValue;

    @Value("${threshold-alert.sound-alarm.blink-interval-ms:5000}")
    private long blinkIntervalMs;

    @Value("${threshold-alert.sound-alarm.on-duration-ms:1000}")
    private long blinkOnDurationMs;

    private final ScheduledExecutorService blinkScheduler = Executors.newScheduledThreadPool(2);
    private final Map<String, ScheduledFuture<?>> blinkingTasks = new ConcurrentHashMap<>();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    @Transactional
    public IngestResultResponse ingest(SensorReadingIngestRequest request) {
        DeviceThresholdRule rule = ruleRepository.findByDeviceId(request.deviceId())
                .orElseThrow(() -> new IllegalArgumentException("设备尚未配置阈值规则: deviceId=" + request.deviceId()));

        LocalDateTime eventTime = parseOrNow(request.collectedAt());
        List<ThresholdAlertRecordResponse> alerts = new ArrayList<>();
        boolean hasAlarmableOutOfRange = false;

        if (rule.isEnabled()) {
            hasAlarmableOutOfRange |= evaluateAndRecord(
                    request.deviceId(),
                    "TEMPERATURE",
                    request.temperature(),
                    rule.getTemperatureMin(),
                    rule.getTemperatureMax(),
                    eventTime,
                    alerts
            );

                    hasAlarmableOutOfRange |= evaluateAndRecord(
                    request.deviceId(),
                    "HUMIDITY",
                    request.humidity(),
                    rule.getHumidityMin(),
                    rule.getHumidityMax(),
                    eventTime,
                    alerts
            );

                    hasAlarmableOutOfRange |= evaluateOptionalAndRecord(
                        request.deviceId(),
                        "LIGHT",
                        request.light(),
                        rule.getLightMin(),
                        rule.getLightMax(),
                        eventTime,
                        alerts
                    );

                        hasAlarmableOutOfRange |= evaluateOptionalAndRecord(
                        request.deviceId(),
                        "CO2",
                        request.co2(),
                        rule.getCo2Min(),
                        rule.getCo2Max(),
                        eventTime,
                        alerts
                    );

                        hasAlarmableOutOfRange |= evaluateOptionalAndRecord(
                        request.deviceId(),
                        "SOIL_HUMIDITY",
                        request.soilHumidity(),
                        rule.getSoilHumidityMin(),
                        rule.getSoilHumidityMax(),
                        eventTime,
                        alerts
                    );

                        hasAlarmableOutOfRange |= evaluateOptionalAndRecord(
                        request.deviceId(),
                        "SOIL_TEMPERATURE",
                        request.soilTemperature(),
                        rule.getSoilTemperatureMin(),
                        rule.getSoilTemperatureMax(),
                        eventTime,
                        alerts
                    );

                if (hasAlarmableOutOfRange) {
                startBlinkingAlarm(request.deviceId(), alerts.size());
            } else {
                stopBlinkingAlarm(request.deviceId(), "监测值恢复正常");
            }
        } else {
            stopBlinkingAlarm(request.deviceId(), "规则禁用");
        }

        return new IngestResultResponse(
                request.deviceId(),
                eventTime.format(DATETIME_FMT),
                alerts.size(),
                alerts
        );
    }

    public List<ThresholdAlertRecordResponse> listAlerts(String deviceId, String startTime, String endTime) {
        LocalDateTime end = parseOrNow(endTime);
        LocalDateTime start = startTime == null || startTime.isBlank()
                ? end.minusDays(7)
                : parseOrNow(startTime);

        List<ThresholdAlertRecord> records;
        if (deviceId == null || deviceId.isBlank()) {
            records = alertRecordRepository.findByAlertedAtBetweenOrderByAlertedAtDesc(start, end);
        } else {
            records = alertRecordRepository.findByDeviceIdAndAlertedAtBetweenOrderByAlertedAtDesc(deviceId, start, end);
        }
        return records.stream().map(this::toResponse).toList();
    }

    public String exportCsv(String deviceId, String startTime, String endTime) {
        List<ThresholdAlertRecordResponse> records = listAlerts(deviceId, startTime, endTime);
        StringBuilder csv = new StringBuilder();
        csv.append("id,deviceId,metricType,currentValue,minThreshold,maxThreshold,alertMessage,alertedAt\n");
        for (ThresholdAlertRecordResponse record : records) {
            csv.append(record.id()).append(',')
                    .append(record.deviceId()).append(',')
                    .append(record.metricType()).append(',')
                    .append(record.currentValue()).append(',')
                    .append(record.minThreshold()).append(',')
                    .append(record.maxThreshold()).append(',')
                    .append('"').append(record.alertMessage().replace("\"", "\"\"")).append('"').append(',')
                    .append(record.alertedAt())
                    .append('\n');
        }
        return csv.toString();
    }

    public void onRuleEnabledChanged(String deviceId, boolean enabled) {
        if (!enabled) {
            stopBlinkingAlarm(deviceId, "用户禁用规则");
        }
    }

    @Transactional
    public void processAlert(Long alertId) {
        ThresholdAlertRecord record = alertRecordRepository.findById(alertId)
                .orElseThrow(() -> new IllegalArgumentException("告警记录不存在: id=" + alertId));
        alertRecordRepository.delete(record);

        stopBlinkingAlarm(record.getDeviceId(), "告警已处理");
        if (soundAlarmEnabled) {
            sendAlarmCommand(record.getDeviceId(), soundParamOffValue, 0);
        }
    }

    @Transactional
    public int processAllAlerts() {
        List<ThresholdAlertRecord> records = alertRecordRepository.findAll();
        if (records.isEmpty()) {
            return 0;
        }

        Set<String> affectedDevices = new HashSet<>();
        for (ThresholdAlertRecord record : records) {
            affectedDevices.add(record.getDeviceId());
        }

        int count = records.size();
        alertRecordRepository.deleteAllInBatch(records);

        for (String deviceId : affectedDevices) {
            stopBlinkingAlarm(deviceId, "一键处理全部告警");
            if (soundAlarmEnabled) {
                sendAlarmCommand(deviceId, soundParamOffValue, 0);
            }
        }
        return count;
    }

    @PreDestroy
    void shutdownBlinkScheduler() {
        blinkingTasks.values().forEach(task -> task.cancel(true));
        blinkingTasks.clear();
        blinkScheduler.shutdownNow();
    }

    private boolean evaluateAndRecord(String deviceId,
                                      String metricType,
                                      BigDecimal currentValue,
                                      BigDecimal minThreshold,
                                      BigDecimal maxThreshold,
                                      LocalDateTime eventTime,
                                      List<ThresholdAlertRecordResponse> alerts) {
        boolean outOfRange = currentValue.compareTo(minThreshold) < 0 || currentValue.compareTo(maxThreshold) > 0;
        if (!outOfRange) {
            return false;
        }

        List<ThresholdAlertRecord> existingRecords =
                alertRecordRepository.findByDeviceIdAndMetricTypeOrderByAlertedAtDesc(deviceId, metricType);

        ThresholdAlertRecord record;
        if (!existingRecords.isEmpty()) {
            record = existingRecords.get(0);
            if (existingRecords.size() > 1) {
                alertRecordRepository.deleteAll(existingRecords.subList(1, existingRecords.size()));
            }
        } else {
            record = new ThresholdAlertRecord();
            record.setDeviceId(deviceId);
            record.setMetricType(metricType);
        }

        record.setCurrentValue(currentValue);
        record.setMinThreshold(minThreshold);
        record.setMaxThreshold(maxThreshold);
        record.setAlertMessage(buildAlertMessage(metricType, currentValue, minThreshold, maxThreshold));
        record.setAlertedAt(eventTime);
        alertRecordRepository.save(record);

        alerts.add(toResponse(record));

        return true;
    }

    private boolean evaluateOptionalAndRecord(String deviceId,
                                              String metricType,
                                              BigDecimal currentValue,
                                              BigDecimal minThreshold,
                                              BigDecimal maxThreshold,
                                              LocalDateTime eventTime,
                                              List<ThresholdAlertRecordResponse> alerts) {
        if (currentValue == null || minThreshold == null || maxThreshold == null) {
            return false;
        }
        return evaluateAndRecord(deviceId, metricType, currentValue, minThreshold, maxThreshold, eventTime, alerts);
    }

    private String buildAlertMessage(String metricType,
                                     BigDecimal currentValue,
                                     BigDecimal minThreshold,
                                     BigDecimal maxThreshold) {
        return String.format(
                "%s异常: 当前值=%s, 阈值范围=[%s, %s]",
                metricType,
                currentValue,
                minThreshold,
                maxThreshold
        );
    }

    private ThresholdAlertRecordResponse toResponse(ThresholdAlertRecord record) {
        return new ThresholdAlertRecordResponse(
                record.getId(),
                record.getDeviceId(),
                record.getMetricType(),
                record.getCurrentValue(),
                record.getMinThreshold(),
                record.getMaxThreshold(),
                record.getAlertMessage(),
                record.getAlertedAt() == null ? null : record.getAlertedAt().format(DATETIME_FMT)
        );
    }

    private LocalDateTime parseOrNow(String value) {
        if (value == null || value.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            return LocalDateTime.parse(value, DATETIME_FMT);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value);
            } catch (DateTimeParseException ex) {
                throw new IllegalArgumentException("时间格式错误，应为 yyyy-MM-dd HH:mm:ss 或 ISO-8601: " + value);
            }
        }
    }

    private void startBlinkingAlarm(String deviceId, int alertCount) {
        if (!soundAlarmEnabled) {
            return;
        }

        ScheduledFuture<?> runningTask = blinkingTasks.get(deviceId);
        if (runningTask != null && !runningTask.isCancelled() && !runningTask.isDone()) {
            return;
        }

        long safeIntervalMs = Math.max(1000L, blinkIntervalMs);
        long safeOnDurationMs = Math.max(200L, blinkOnDurationMs);

        Runnable cycle = () -> {
            sendAlarmCommand(deviceId, soundParamValue, alertCount);
            blinkScheduler.schedule(
                    () -> sendAlarmCommand(deviceId, soundParamOffValue, alertCount),
                    safeOnDurationMs,
                    TimeUnit.MILLISECONDS
            );
        };

        ScheduledFuture<?> future = blinkScheduler.scheduleWithFixedDelay(
                cycle,
                0,
                safeIntervalMs,
                TimeUnit.MILLISECONDS
        );
        blinkingTasks.put(deviceId, future);
        log.info("阈值告警灯光循环任务已启动: deviceId={}, intervalMs={}, onDurationMs={}",
                deviceId, safeIntervalMs, safeOnDurationMs);
    }

    private void stopBlinkingAlarm(String deviceId, String reason) {
        ScheduledFuture<?> future = blinkingTasks.remove(deviceId);
        if (future != null) {
            future.cancel(false);
            if (soundAlarmEnabled) {
                sendAlarmCommand(deviceId, soundParamOffValue, 0);
            }
            log.info("阈值告警灯光循环任务已停止: deviceId={}, reason={}", deviceId, reason);
        }
    }

    private void sendAlarmCommand(String deviceId, String paramValue, int alertCount) {
        Map<String, Object> payload = new LinkedHashMap<>();
        String requestId = "threshold-alert-" + UUID.randomUUID();
        payload.put("deviceId", deviceId);
        payload.put("commandType", soundCommandType);
        payload.put("params", Map.of(soundParamKey, paramValue));
        payload.put("requestId", requestId);

        String body;
        try {
            body = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            log.error("阈值告警触发声音报警失败: JSON 序列化异常, deviceId={}", deviceId, ex);
            return;
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(iotCommandUrl))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("阈值告警联动命令返回非成功状态: deviceId={}, alertCount={}, commandType={}, paramKey={}, paramValue={}, status={}, body={}",
                        deviceId, alertCount, soundCommandType, soundParamKey, paramValue, response.statusCode(), response.body());
            } else {
                log.info("阈值告警已触发联动命令: deviceId={}, alertCount={}, requestId={}, commandType={}, paramKey={}, paramValue={}, status={}",
                        deviceId, alertCount, requestId, soundCommandType, soundParamKey, paramValue, response.statusCode());
            }
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.error("阈值告警联动命令调用失败: deviceId={}, alertCount={}, requestId={}, commandType={}, paramKey={}, paramValue={}",
                    deviceId, alertCount, requestId, soundCommandType, soundParamKey, paramValue, ex);
        }
    }

}
