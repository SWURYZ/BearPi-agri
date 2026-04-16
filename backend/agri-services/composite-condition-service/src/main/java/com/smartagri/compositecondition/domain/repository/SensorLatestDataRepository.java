package com.smartagri.compositecondition.domain.repository;

import com.smartagri.compositecondition.domain.entity.SensorLatestData;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SensorLatestDataRepository extends JpaRepository<SensorLatestData, String> {

    Optional<SensorLatestData> findByDeviceIdAndMetric(String deviceId, String metric);
}
