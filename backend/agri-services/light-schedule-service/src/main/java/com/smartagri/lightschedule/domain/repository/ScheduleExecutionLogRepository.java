package com.smartagri.lightschedule.domain.repository;

import com.smartagri.lightschedule.domain.entity.ScheduleExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduleExecutionLogRepository extends JpaRepository<ScheduleExecutionLog, Long> {

    List<ScheduleExecutionLog> findByRuleIdOrderByExecutedAtDesc(Long ruleId);

    List<ScheduleExecutionLog> findByRuleIdAndExecutedAtAfter(Long ruleId, LocalDateTime after);

    List<ScheduleExecutionLog> findByRuleIdAndActionAndExecutedAtAfter(Long ruleId, String action, LocalDateTime after);
}
