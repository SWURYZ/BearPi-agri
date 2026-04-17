package com.smartagri.thresholdalert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartagri.thresholdalert.domain.entity.DeviceThresholdRule;
import com.smartagri.thresholdalert.domain.repository.DeviceThresholdRuleRepository;
import com.smartagri.thresholdalert.dto.IngestResultResponse;
import com.smartagri.thresholdalert.dto.SensorReadingIngestRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
@RequiredArgsConstructor
public class ThresholdAutoPollService {

    private final DeviceThresholdRuleRepository ruleRepository;
    private final ThresholdAlertService thresholdAlertService;
    private final ThresholdAutoPollConfigService autoPollConfigService;
    private final ObjectMapper objectMapper;

    @Value("${threshold-alert.auto-poll.enabled:true}")
    private boolean autoPollEnabled;

    @Value("${threshold-alert.auto-poll.iot-latest-url-template:http://localhost:8082/api/v1/iot/devices/%s/latest}")
    private String iotLatestUrlTemplate;

    @Value("${threshold-alert.auto-poll.scheduler-tick-ms:5000}")
    private long schedulerTickMs;

    private final AtomicLong lastPollTimestampMs = new AtomicLong(0L);

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    @Scheduled(fixedDelayString = "${threshold-alert.auto-poll.scheduler-tick-ms:5000}",
            initialDelayString = "${threshold-alert.auto-poll.initial-delay-ms:10000}")
    public void pollEnabledDevicesAndAlert() {
        if (!autoPollEnabled) {
            return;
        }

        int intervalMinutes = autoPollConfigService.resolveIntervalMinutes();
        long intervalMs = Math.max(1L, intervalMinutes) * 60_000L;
        long now = System.currentTimeMillis();
        if (now - lastPollTimestampMs.get() < intervalMs) {
            return;
        }

        synchronized (this) {
            long checkNow = System.currentTimeMillis();
            if (checkNow - lastPollTimestampMs.get() < intervalMs) {
                return;
            }
            lastPollTimestampMs.set(checkNow);
        }

        List<DeviceThresholdRule> enabledRules = ruleRepository.findByEnabledTrue();
        if (enabledRules.isEmpty()) {
            return;
        }

        log.info("自动轮询任务开始: enabledDevices={}, intervalMinutes={}, schedulerTickMs={}",
                enabledRules.size(), intervalMinutes, schedulerTickMs);

        for (DeviceThresholdRule rule : enabledRules) {
            try {
                pollSingleDevice(rule.getDeviceId());
            } catch (Exception ex) {
                log.warn("自动轮询设备失败: deviceId={}", rule.getDeviceId(), ex);
            }
        }
    }

    private void pollSingleDevice(String deviceId) throws IOException, InterruptedException {
        String encodedDeviceId = URLEncoder.encode(deviceId, StandardCharsets.UTF_8).replace("+", "%20");
        String latestUrl = String.format(iotLatestUrlTemplate, encodedDeviceId);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(latestUrl))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            log.warn("自动轮询读取设备最新数据失败: deviceId={}, status={}, body={}",
                    deviceId, response.statusCode(), response.body());
            return;
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode data = root.path("data");
        if (data.isMissingNode() || data.isNull()) {
            log.debug("自动轮询读取到空数据: deviceId={}", deviceId);
            return;
        }

        JsonNode temperatureNode = data.get("temperature");
        JsonNode humidityNode = data.get("humidity");
        if (temperatureNode == null || humidityNode == null || !temperatureNode.isNumber() || !humidityNode.isNumber()) {
            log.warn("自动轮询数据缺少温湿度: deviceId={}, payload={}", deviceId, data);
            return;
        }

        JsonNode rawProperties = parseRawProperties(data.path("rawPayload").asText(null));
        BigDecimal light = readNumber(rawProperties, "Luminance", "luminance", "Light", "light");
        BigDecimal co2 = readNumber(rawProperties, "CO2", "co2", "Co2", "carbonDioxide");
        BigDecimal soilHumidity = readNumber(rawProperties, "SoilHumidity", "soilHumidity", "soil_humidity");
        BigDecimal soilTemperature = readNumber(rawProperties, "SoilTemperature", "soilTemperature", "soilTemp", "soil_temp");

        String reportTime = data.path("reportTime").isMissingNode() || data.path("reportTime").isNull()
                ? null
                : data.path("reportTime").asText();

        IngestResultResponse result = thresholdAlertService.ingest(new SensorReadingIngestRequest(
                deviceId,
                BigDecimal.valueOf(temperatureNode.asDouble()),
                BigDecimal.valueOf(humidityNode.asDouble()),
            light,
            co2,
            soilHumidity,
            soilTemperature,
                reportTime
        ));

        if (result.alertCount() > 0) {
            log.info("自动轮询触发阈值告警: deviceId={}, alertCount={}", deviceId, result.alertCount());
        }
    }

    private JsonNode parseRawProperties(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            JsonNode services = root.path("notify_data").path("body").path("services");
            if (!services.isArray()) {
                return objectMapper.createObjectNode();
            }
            for (JsonNode serviceNode : services) {
                JsonNode properties = serviceNode.path("properties");
                if (properties.isObject()) {
                    return properties;
                }
            }
        } catch (Exception ignored) {
        }
        return objectMapper.createObjectNode();
    }

    private BigDecimal readNumber(JsonNode source, String... aliases) {
        for (String key : aliases) {
            JsonNode node = source.get(key);
            if (node == null || node.isNull()) {
                continue;
            }
            if (node.isNumber()) {
                return BigDecimal.valueOf(node.asDouble());
            }
            if (node.isTextual()) {
                try {
                    return new BigDecimal(node.asText().trim());
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return null;
    }
}
