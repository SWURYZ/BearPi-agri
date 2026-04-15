package com.smartagri.iotaccess.service;

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
import com.smartagri.iotaccess.config.HuaweiIotProperties;
import com.smartagri.iotaccess.domain.entity.DeviceCommandLog;
import com.smartagri.iotaccess.domain.repository.DeviceCommandLogRepository;
import com.smartagri.iotaccess.dto.CommandDispatchResponse;
import com.smartagri.iotaccess.dto.DeviceControlRequest;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HuaweiIotCommandService {

    private final HuaweiIotProperties properties;
    private final DeviceCommandLogRepository commandLogRepository;
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

    public CommandDispatchResponse dispatch(DeviceControlRequest request) {
        String requestId = StringUtils.hasText(request.requestId()) ? request.requestId() : UUID.randomUUID().toString();
        DeviceCommandLog commandLog = new DeviceCommandLog();
        commandLog.setDeviceId(request.deviceId());
        commandLog.setRequestId(requestId);
        commandLog.setCommandType(request.commandType());
        commandLog.setStatus("PENDING");
        commandLog.setCommandPayload(toJson(request.params()));
        commandLogRepository.save(commandLog);

        if (!properties.isCommandEnabled() || client == null) {
            commandLog.setStatus("SKIPPED");
            commandLog.setErrorMessage("Huawei IoT command dispatch is disabled or client is not initialized");
            commandLog.setUpdatedAt(LocalDateTime.now());
            commandLogRepository.save(commandLog);
            return new CommandDispatchResponse(requestId, null, "SKIPPED", commandLog.getErrorMessage());
        }

        DeviceMessageRequest body = new DeviceMessageRequest();
        body.setMessage(buildCloudPayload(request.commandType(), request.params()));

        CreateMessageRequest cloudRequest = new CreateMessageRequest()
                .withDeviceId(request.deviceId())
                .withBody(body);

        try {
            CreateMessageResponse response = client.createMessage(cloudRequest);
            commandLog.setCloudCommandId(response.getMessageId());
            commandLog.setStatus("SENT");
            commandLog.setUpdatedAt(LocalDateTime.now());
            commandLogRepository.save(commandLog);
            return new CommandDispatchResponse(requestId, response.getMessageId(), "SENT", "消息已成功下发到华为云");
        } catch (ServiceResponseException ex) {
            commandLog.setStatus("FAILED");
            commandLog.setErrorMessage("[" + ex.getErrorCode() + "] " + ex.getErrorMsg());
            commandLog.setUpdatedAt(LocalDateTime.now());
            commandLogRepository.save(commandLog);
            return new CommandDispatchResponse(requestId, null, "FAILED", commandLog.getErrorMessage());
        } catch (Exception ex) {
            commandLog.setStatus("FAILED");
            commandLog.setErrorMessage(ex.getClass().getSimpleName() + ": " + ex.getMessage());
            commandLog.setUpdatedAt(LocalDateTime.now());
            commandLogRepository.save(commandLog);
            return new CommandDispatchResponse(requestId, null, "FAILED", commandLog.getErrorMessage());
        }
    }

    public Optional<DeviceCommandLog> findByRequestId(String requestId) {
        return commandLogRepository.findByRequestId(requestId);
    }

    public void updateCommandStatus(String cloudCommandId, String status) {
        commandLogRepository.findByCloudCommandId(cloudCommandId).ifPresent(command -> {
            command.setStatus(status);
            command.setUpdatedAt(LocalDateTime.now());
            commandLogRepository.save(command);
        });
    }

    private Region resolveRegion() {
        if (StringUtils.hasText(properties.getEndpoint())) {
            String endpoint = properties.getEndpoint().trim();
            if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
                endpoint = "https://" + endpoint;
            }
            return new Region(properties.getRegion().trim(), endpoint);
        }
        return new Region(properties.getRegion().trim(), "https://iotda." + properties.getRegion().trim() + ".myhuaweicloud.com");
    }

    private Map<String, Object> buildCloudPayload(String commandType, Map<String, Object> params) {
        Map<String, Object> payload = new HashMap<>();
        String normalizedType = commandType == null ? "" : commandType.trim().toUpperCase();
        switch (normalizedType) {
            case "LIGHT_CONTROL" -> payload.put("led", params.getOrDefault("Light", params.getOrDefault("led", "OFF")));
            case "MOTOR_CONTROL" -> payload.put("motor", params.getOrDefault("Motor", params.getOrDefault("motor", "OFF")));
            default -> payload.putAll(params);
        }
        return payload;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return String.valueOf(value);
        }
    }
}
