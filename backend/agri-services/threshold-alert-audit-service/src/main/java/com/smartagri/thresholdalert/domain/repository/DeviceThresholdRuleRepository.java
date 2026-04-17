package com.smartagri.thresholdalert.domain.repository;

import com.smartagri.thresholdalert.domain.entity.DeviceThresholdRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceThresholdRuleRepository extends JpaRepository<DeviceThresholdRule, Long> {

    Optional<DeviceThresholdRule> findByDeviceId(String deviceId);

    List<DeviceThresholdRule> findByEnabledTrue();
}
