package com.smartagri.lightschedule.domain.repository;

import com.smartagri.lightschedule.domain.entity.ScheduleRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalTime;
import java.util.List;

public interface ScheduleRuleRepository extends JpaRepository<ScheduleRule, Long> {

    List<ScheduleRule> findByEnabledTrue();

    List<ScheduleRule> findByDeviceId(String deviceId);

    boolean existsByCommandTypeAndRuleNameAndTurnOnTimeAndTurnOffTime(
            String commandType, String ruleName, LocalTime turnOnTime, LocalTime turnOffTime);
}
