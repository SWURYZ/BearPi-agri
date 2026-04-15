package com.smartagri.devicecontrol.domain.repository;

import com.smartagri.devicecontrol.domain.entity.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeviceStatusRepository extends JpaRepository<DeviceStatus, Long> {

    Optional<DeviceStatus> findByDeviceId(String deviceId);
}
