package com.smartagri.compositecondition.domain.repository;

import com.smartagri.compositecondition.domain.entity.LinkageActionLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LinkageActionLogRepository extends JpaRepository<LinkageActionLog, Long> {

    List<LinkageActionLog> findByRuleIdOrderByTriggeredAtDesc(Long ruleId);

    List<LinkageActionLog> findByTargetDeviceIdOrderByTriggeredAtDesc(String targetDeviceId);
}
