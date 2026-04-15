package com.smartagri.devicecontrol.service;

import com.smartagri.devicecontrol.domain.entity.ControlCommand;
import com.smartagri.devicecontrol.domain.entity.DeviceStatus;
import com.smartagri.devicecontrol.domain.repository.ControlCommandRepository;
import com.smartagri.devicecontrol.domain.repository.DeviceStatusRepository;
import com.smartagri.devicecontrol.dto.DeviceStatusResponse;
import com.smartagri.devicecontrol.dto.ManualControlResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceControlService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final MqttCommandService mqttCommandService;
    private final ControlCommandRepository commandRepository;
    private final DeviceStatusRepository deviceStatusRepository;

    @Transactional
    public ManualControlResponse manualControl(String deviceId, String commandType, String action) {
        ManualControlResponse response = mqttCommandService.sendCommand(deviceId, commandType, action);

        if ("SENT".equals(response.status()) || "DELIVERED".equals(response.status())) {
            updateDeviceStatus(deviceId, commandType, action);
        }

        return response;
    }

    public DeviceStatusResponse getDeviceStatus(String deviceId) {
        Optional<DeviceStatus> statusOpt = deviceStatusRepository.findByDeviceId(deviceId);
        if (statusOpt.isEmpty()) {
            return new DeviceStatusResponse(deviceId, "UNKNOWN", "UNKNOWN", null);
        }
        DeviceStatus status = statusOpt.get();
        return new DeviceStatusResponse(
                status.getDeviceId(),
                status.getLedStatus(),
                status.getMotorStatus(),
                status.getLastUpdated() == null ? null : status.getLastUpdated().format(FORMATTER)
        );
    }

    public List<ControlCommand> getCommandHistory(String deviceId) {
        return commandRepository.findByDeviceIdOrderByCreatedAtDesc(deviceId);
    }

    public Optional<ControlCommand> getCommandByRequestId(String requestId) {
        return commandRepository.findByRequestId(requestId);
    }

    @Transactional
    public void handleFeedback(String cloudMessageId, String resultCode) {
        mqttCommandService.updateCommandByFeedback(cloudMessageId, resultCode);

        commandRepository.findByCloudMessageId(cloudMessageId).ifPresent(cmd -> {
            if ("0".equals(resultCode) || "SUCCESS".equalsIgnoreCase(resultCode)) {
                updateDeviceStatus(cmd.getDeviceId(), cmd.getCommandType(),
                        extractActionFromPayload(cmd.getCommandPayload()));
            }
        });
    }

    private void updateDeviceStatus(String deviceId, String commandType, String action) {
        DeviceStatus status = deviceStatusRepository.findByDeviceId(deviceId)
                .orElseGet(() -> {
                    DeviceStatus s = new DeviceStatus();
                    s.setDeviceId(deviceId);
                    return s;
                });

        String normalizedType = commandType == null ? "" : commandType.trim().toUpperCase();
        switch (normalizedType) {
            case "LIGHT_CONTROL" -> status.setLedStatus(action);
            case "MOTOR_CONTROL" -> status.setMotorStatus(action);
        }

        deviceStatusRepository.save(status);
    }

    private String extractActionFromPayload(String payload) {
        if (payload == null) {
            return "UNKNOWN";
        }
        if (payload.contains("\"led\"")) {
            return payload.contains("ON") ? "ON" : "OFF";
        }
        if (payload.contains("\"motor\"")) {
            return payload.contains("ON") ? "ON" : "OFF";
        }
        return "UNKNOWN";
    }
}
