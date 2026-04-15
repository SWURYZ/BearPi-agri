package com.smartagri.iotaccess.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartagri.iotaccess.domain.entity.DeviceTelemetry;
import com.smartagri.iotaccess.domain.repository.DeviceTelemetryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryIngestionService {

    private final DeviceTelemetryRepository telemetryRepository;
    private final ObjectMapper objectMapper;

    public void ingest(JsonNode root) {
        JsonNode notifyData = root.path("notify_data");
        JsonNode body = notifyData.path("body");
        JsonNode services = body.path("services");
        if (!services.isArray()) {
            log.info("忽略非遥测消息: body.services 不是数组, payload={}", root);
            return;
        }

        String deviceId = textOrNull(notifyData.path("header").path("device_id"));
        String rawPayload = root.toString();
        boolean saved = false;

        for (JsonNode serviceNode : services) {
            String serviceId = textOrNull(serviceNode.path("service_id"));
            if (!"Agriculture".equals(serviceId)) {
                log.info("跳过非 Agriculture 服务消息, deviceId={}, serviceId={}", deviceId, serviceId);
                continue;
            }

            JsonNode properties = serviceNode.path("properties");
            if (properties.isMissingNode() || properties.isNull()) {
                log.warn("Agriculture 消息缺少 properties, deviceId={}, payload={}", deviceId, root);
                continue;
            }
            DeviceTelemetry telemetry = new DeviceTelemetry();
            telemetry.setDeviceId(deviceId);
            telemetry.setServiceId(serviceId);
            telemetry.setTemperature(numberOrNull(properties.get("Temperature")));
            telemetry.setHumidity(numberOrNull(properties.get("Humidity")));
            telemetry.setLuminance(numberOrNull(properties.get("Luminance")));
            telemetry.setLedStatus(textOrNull(properties.get("LightStatus")));
            telemetry.setMotorStatus(textOrNull(properties.get("MotorStatus")));
            telemetry.setReportTime(resolveReportTime(serviceNode));
            telemetry.setRawPayload(rawPayload);
            telemetryRepository.save(telemetry);
            saved = true;
            log.info("遥测数据已保存, deviceId={}, temperature={}, humidity={}, luminance={}, ledStatus={}, motorStatus={}",
                    deviceId,
                    telemetry.getTemperature(),
                    telemetry.getHumidity(),
                    telemetry.getLuminance(),
                    telemetry.getLedStatus(),
                    telemetry.getMotorStatus());
        }

        if (!saved) {
            log.info("消息已解析但未保存任何遥测数据, deviceId={}, payload={}", deviceId, root);
        }
    }

    public DeviceTelemetry latest(String deviceId) {
        return telemetryRepository.findFirstByDeviceIdOrderByReportTimeDesc(deviceId);
    }

    public java.util.List<DeviceTelemetry> recent(String deviceId, int minutes) {
        return telemetryRepository.findByDeviceIdAndReportTimeAfterOrderByReportTimeAsc(
                deviceId,
                LocalDateTime.now().minusMinutes(minutes)
        );
    }

    private LocalDateTime resolveReportTime(JsonNode serviceNode) {
        for (String field : new String[]{"event_time", "report_time"}) {
            JsonNode node = serviceNode.get(field);
            if (node == null || node.isNull() || node.asText().isBlank()) {
                continue;
            }
            try {
                return OffsetDateTime.parse(node.asText()).toLocalDateTime();
            } catch (DateTimeParseException ignored) {
            }
        }
        return LocalDateTime.now();
    }

    private String textOrNull(JsonNode node) {
        return Optional.ofNullable(node)
                .filter(n -> !n.isMissingNode() && !n.isNull())
                .map(JsonNode::asText)
                .filter(text -> !text.isBlank())
                .orElse(null);
    }

    private Double numberOrNull(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        if (node.isNumber()) {
            return node.asDouble();
        }
        try {
            return objectMapper.convertValue(node, Double.class);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
