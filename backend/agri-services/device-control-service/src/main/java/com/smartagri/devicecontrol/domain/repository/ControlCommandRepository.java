package com.smartagri.devicecontrol.domain.repository;

import com.smartagri.devicecontrol.domain.entity.ControlCommand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ControlCommandRepository extends JpaRepository<ControlCommand, Long> {

    Optional<ControlCommand> findByRequestId(String requestId);

    Optional<ControlCommand> findByCloudMessageId(String cloudMessageId);

    List<ControlCommand> findByDeviceIdOrderByCreatedAtDesc(String deviceId);
}
