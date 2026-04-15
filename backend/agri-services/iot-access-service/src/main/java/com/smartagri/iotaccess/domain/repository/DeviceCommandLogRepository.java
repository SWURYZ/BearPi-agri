package com.smartagri.iotaccess.domain.repository;

import com.smartagri.iotaccess.domain.entity.DeviceCommandLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeviceCommandLogRepository extends JpaRepository<DeviceCommandLog, Long> {

    Optional<DeviceCommandLog> findByRequestId(String requestId);

    Optional<DeviceCommandLog> findByCloudCommandId(String cloudCommandId);
}
