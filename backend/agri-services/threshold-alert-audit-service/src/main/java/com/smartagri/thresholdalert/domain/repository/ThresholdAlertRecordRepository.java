package com.smartagri.thresholdalert.domain.repository;

import com.smartagri.thresholdalert.domain.entity.ThresholdAlertRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ThresholdAlertRecordRepository extends JpaRepository<ThresholdAlertRecord, Long> {

    List<ThresholdAlertRecord> findByAlertedAtBetweenOrderByAlertedAtDesc(LocalDateTime start, LocalDateTime end);

    List<ThresholdAlertRecord> findByDeviceIdAndAlertedAtBetweenOrderByAlertedAtDesc(
            String deviceId, LocalDateTime start, LocalDateTime end);

    List<ThresholdAlertRecord> findByDeviceIdAndMetricTypeOrderByAlertedAtDesc(String deviceId, String metricType);
}
