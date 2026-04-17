package com.smartagri.smartdecision.service;

import com.smartagri.smartdecision.domain.entity.DeviceTelemetry;
import com.smartagri.smartdecision.domain.repository.DeviceTelemetryRepository;
import com.smartagri.smartdecision.dto.SensorSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SensorDataService {

    private static final String DEFAULT_DEVICE_ID = "69d75b1d7f2e6c302f654fea_20031104";

    private final DeviceTelemetryRepository telemetryRepository;

    public SensorSnapshot getLatest(String deviceId) {
        String id = (deviceId != null && !deviceId.isBlank()) ? deviceId : DEFAULT_DEVICE_ID;
        DeviceTelemetry t = telemetryRepository.findFirstByDeviceIdOrderByReportTimeDesc(id);
        if (t == null) {
            return new SensorSnapshot(null, null, null, null, null, null);
        }
        return new SensorSnapshot(
                t.getTemperature(), t.getHumidity(), t.getLuminance(),
                t.getLedStatus(), t.getMotorStatus(), t.getReportTime()
        );
    }

    public List<DeviceTelemetry> getRecent(String deviceId, int minutes) {
        String id = (deviceId != null && !deviceId.isBlank()) ? deviceId : DEFAULT_DEVICE_ID;
        return telemetryRepository.findByDeviceIdAndReportTimeAfterOrderByReportTimeAsc(
                id, LocalDateTime.now().minusMinutes(minutes));
    }

    public String formatSensorContext(SensorSnapshot s) {
        if (s == null || s.reportTime() == null) {
            return "当前无传感器数据。";
        }
        return String.format("""
                【当前传感器数据】
                - 温度: %s ℃
                - 湿度: %s %%
                - 光照强度: %s lux
                - 补光灯状态: %s
                - 风扇状态: %s
                - 上报时间: %s""",
                s.temperature() != null ? String.format("%.1f", s.temperature()) : "N/A",
                s.humidity() != null ? String.format("%.1f", s.humidity()) : "N/A",
                s.luminance() != null ? String.format("%.0f", s.luminance()) : "N/A",
                s.ledStatus() != null ? s.ledStatus() : "N/A",
                s.motorStatus() != null ? s.motorStatus() : "N/A",
                s.reportTime());
    }
}
