package com.smartagri.devicecontrol.service;

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
import com.smartagri.devicecontrol.config.DeviceControlProperties;
import com.smartagri.devicecontrol.domain.entity.ControlCommand;
import com.smartagri.devicecontrol.domain.repository.ControlCommandRepository;
import com.smartagri.devicecontrol.dto.ManualControlResponse;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MqttCommandService {

    private final DeviceControlProperties properties;
    private final ControlCommandRepository commandRepository;
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

    public ManualControlResponse sendCommand(String deviceId, String commandType, String action) {
        String requestId = UUID.randomUUID().toString();

        ControlCommand command = new ControlCommand();
        command.setDeviceId(deviceId);
        command.setRequestId(requestId);
        command.setCommandType(commandType);
        command.setCommandPayload(toJson(buildPayload(commandType, action)));
        command.setStatus("PENDING");
        commandRepository.save(command);

        if (!properties.isCommandEnabled() || client == null) {
            command.setStatus("SKIPPED");
            command.setErrorMessage("Command dispatch is disabled or IoT client not initialized");
            command.setUpdatedAt(LocalDateTime.now());
            commandRepository.save(command);
            return new ManualControlResponse(requestId, null, "SKIPPED", command.getErrorMessage());
        }

        DeviceMessageRequest body = new DeviceMessageRequest();
        body.setMessage(buildPayload(commandType, action));

        CreateMessageRequest cloudRequest = new CreateMessageRequest()
                .withDeviceId(deviceId)
                .withBody(body);

        try {
            CreateMessageResponse response = client.createMessage(cloudRequest);
            command.setCloudMessageId(response.getMessageId());
            command.setStatus("SENT");
            command.setUpdatedAt(LocalDateTime.now());
            commandRepository.save(command);
            log.info("指令已下发, deviceId={}, commandType={}, action={}, messageId={}",
                    deviceId, commandType, action, response.getMessageId());
            return new ManualControlResponse(requestId, response.getMessageId(), "SENT", "指令已成功下发到云平台");
        } catch (ServiceResponseException ex) {
            command.setStatus("FAILED");
            command.setErrorMessage("[" + ex.getErrorCode() + "] " + ex.getErrorMsg());
            command.setUpdatedAt(LocalDateTime.now());
            commandRepository.save(command);
            log.error("指令下发失败, deviceId={}, error={}", deviceId, command.getErrorMessage());
            return new ManualControlResponse(requestId, null, "FAILED", command.getErrorMessage());
        } catch (Exception ex) {
            command.setStatus("FAILED");
            command.setErrorMessage(ex.getClass().getSimpleName() + ": " + ex.getMessage());
            command.setUpdatedAt(LocalDateTime.now());
            commandRepository.save(command);
            log.error("指令下发异常, deviceId={}", deviceId, ex);
            return new ManualControlResponse(requestId, null, "FAILED", command.getErrorMessage());
        }
    }

    public void updateCommandByFeedback(String cloudMessageId, String resultCode) {
        commandRepository.findByCloudMessageId(cloudMessageId).ifPresent(cmd -> {
            cmd.setResultCode(resultCode);
            cmd.setStatus("DELIVERED");
            cmd.setUpdatedAt(LocalDateTime.now());
            commandRepository.save(cmd);
            log.info("收到设备反馈, cloudMessageId={}, resultCode={}", cloudMessageId, resultCode);
        });
    }

    private Map<String, Object> buildPayload(String commandType, String action) {
        Map<String, Object> payload = new HashMap<>();
        String normalizedType = commandType == null ? "" : commandType.trim().toUpperCase();
        switch (normalizedType) {
            case "LIGHT_CONTROL" -> payload.put("led", action);
            case "MOTOR_CONTROL" -> payload.put("motor", action);
            default -> payload.put("command", action);
        }
        return payload;
    }

    private Region resolveRegion() {
        if (StringUtils.hasText(properties.getEndpoint())) {
            String endpoint = properties.getEndpoint().trim();
            if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
                endpoint = "https://" + endpoint;
            }
            return new Region(properties.getRegion().trim(), endpoint);
        }
        return new Region(properties.getRegion().trim(),
                "https://iotda." + properties.getRegion().trim() + ".myhuaweicloud.com");
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return String.valueOf(value);
        }
    }
}
