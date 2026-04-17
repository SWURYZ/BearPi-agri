package com.smartagri.thresholdalert.service;

import com.smartagri.thresholdalert.domain.entity.DeviceThresholdRule;
import com.smartagri.thresholdalert.domain.repository.DeviceThresholdRuleRepository;
import com.smartagri.thresholdalert.dto.ThresholdRuleRequest;
import com.smartagri.thresholdalert.dto.ThresholdRuleResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ThresholdRuleService {

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final DeviceThresholdRuleRepository ruleRepository;
    private final ThresholdAlertService thresholdAlertService;

    public List<ThresholdRuleResponse> listAll() {
        return ruleRepository.findAll().stream().map(this::toResponse).toList();
    }

    public ThresholdRuleResponse getByDeviceId(String deviceId) {
        DeviceThresholdRule rule = ruleRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("未找到设备阈值规则: deviceId=" + deviceId));
        return toResponse(rule);
    }

    @Transactional
    public ThresholdRuleResponse upsert(ThresholdRuleRequest request) {
        DeviceThresholdRule rule = ruleRepository.findByDeviceId(request.deviceId())
                .orElseGet(DeviceThresholdRule::new);

        if (rule.getId() == null) {
            rule.setDeviceId(request.deviceId());
            rule.setCreatedAt(LocalDateTime.now());
        }

        rule.setTemperatureMin(request.temperatureMin());
        rule.setTemperatureMax(request.temperatureMax());
        rule.setHumidityMin(request.humidityMin());
        rule.setHumidityMax(request.humidityMax());
        rule.setLightMin(request.lightMin());
        rule.setLightMax(request.lightMax());
        rule.setCo2Min(request.co2Min());
        rule.setCo2Max(request.co2Max());
        rule.setSoilHumidityMin(request.soilHumidityMin());
        rule.setSoilHumidityMax(request.soilHumidityMax());
        rule.setSoilTemperatureMin(request.soilTemperatureMin());
        rule.setSoilTemperatureMax(request.soilTemperatureMax());
        rule.setEnabled(request.enabled() == null || request.enabled());
        rule.setUpdatedAt(LocalDateTime.now());

        ruleRepository.save(rule);
        thresholdAlertService.onRuleEnabledChanged(rule.getDeviceId(), rule.isEnabled());
        return toResponse(rule);
    }

    private ThresholdRuleResponse toResponse(DeviceThresholdRule rule) {
        return new ThresholdRuleResponse(
                rule.getId(),
                rule.getDeviceId(),
                rule.getTemperatureMin(),
                rule.getTemperatureMax(),
                rule.getHumidityMin(),
                rule.getHumidityMax(),
                rule.getLightMin(),
                rule.getLightMax(),
                rule.getCo2Min(),
                rule.getCo2Max(),
                rule.getSoilHumidityMin(),
                rule.getSoilHumidityMax(),
                rule.getSoilTemperatureMin(),
                rule.getSoilTemperatureMax(),
                rule.isEnabled(),
                rule.getCreatedAt() == null ? null : rule.getCreatedAt().format(DATETIME_FMT),
                rule.getUpdatedAt() == null ? null : rule.getUpdatedAt().format(DATETIME_FMT)
        );
    }
}
