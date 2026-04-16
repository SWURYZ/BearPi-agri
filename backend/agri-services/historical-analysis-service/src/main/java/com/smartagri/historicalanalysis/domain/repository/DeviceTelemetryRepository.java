package com.smartagri.historicalanalysis.domain.repository;

import com.smartagri.historicalanalysis.domain.entity.DeviceTelemetry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface DeviceTelemetryRepository extends JpaRepository<DeviceTelemetry, Long> {

    DeviceTelemetry findFirstByDeviceIdOrderByReportTimeDesc(String deviceId);

    List<DeviceTelemetry> findByDeviceIdAndReportTimeAfterOrderByReportTimeAsc(String deviceId, LocalDateTime after);
}
