package com.smartagri.greenhousemonitor.domain.repository;

import com.smartagri.greenhousemonitor.domain.entity.DeviceGreenhouseMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceGreenhouseMappingRepository extends JpaRepository<DeviceGreenhouseMapping, Long> {

    Optional<DeviceGreenhouseMapping> findByDeviceId(String deviceId);

    List<DeviceGreenhouseMapping> findByGreenhouseCode(String greenhouseCode);

    List<DeviceGreenhouseMapping> findByGreenhouseCodeAndStatus(String greenhouseCode, String status);
}
