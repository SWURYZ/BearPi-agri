package com.smartagri.lightschedule.service;

import com.smartagri.lightschedule.domain.entity.ScheduleExecutionLog;
import com.smartagri.lightschedule.domain.entity.ScheduleRule;
import com.smartagri.lightschedule.domain.repository.ScheduleExecutionLogRepository;
import com.smartagri.lightschedule.domain.repository.ScheduleRuleRepository;
import com.smartagri.lightschedule.dto.ScheduleRuleRequest;
import com.smartagri.lightschedule.dto.ScheduleRuleResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleRuleService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ScheduleRuleRepository ruleRepository;
    private final ScheduleExecutionLogRepository executionLogRepository;

    public List<ScheduleRuleResponse> listAll() {
        return ruleRepository.findAll().stream().map(this::toResponse).toList();
    }

    public List<ScheduleRuleResponse> listByDevice(String deviceId) {
        return ruleRepository.findByDeviceId(deviceId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public ScheduleRuleResponse create(ScheduleRuleRequest request) {
        String commandType = request.commandType() == null ? "LIGHT_CONTROL" : request.commandType();
        LocalTime onTime = LocalTime.parse(request.turnOnTime(), TIME_FMT);
        LocalTime offTime = LocalTime.parse(request.turnOffTime(), TIME_FMT);

        boolean duplicate = ruleRepository.existsByCommandTypeAndRuleNameAndTurnOnTimeAndTurnOffTime(
                commandType, request.ruleName(), onTime, offTime);
        if (duplicate) {
            throw new IllegalArgumentException("已存在相同的定时规则（控制类型、规则名称、开启时间和关闭时间均相同），请勿重复添加");
        }

        ScheduleRule rule = new ScheduleRule();
        rule.setDeviceId(request.deviceId());
        rule.setRuleName(request.ruleName());
        rule.setTurnOnTime(onTime);
        rule.setTurnOffTime(offTime);
        rule.setRepeatMode(request.repeatMode() == null ? "DAILY" : request.repeatMode());
        rule.setCommandType(commandType);
        rule.setEnabled(request.enabled() == null || request.enabled());
        ruleRepository.save(rule);
        return toResponse(rule);
    }

    @Transactional
    public ScheduleRuleResponse update(Long id, ScheduleRuleRequest request) {
        ScheduleRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("定时规则不存在: id=" + id));
        rule.setDeviceId(request.deviceId());
        rule.setRuleName(request.ruleName());
        rule.setTurnOnTime(LocalTime.parse(request.turnOnTime(), TIME_FMT));
        rule.setTurnOffTime(LocalTime.parse(request.turnOffTime(), TIME_FMT));
        if (request.repeatMode() != null) {
            rule.setRepeatMode(request.repeatMode());
        }
        if (request.commandType() != null) {
            rule.setCommandType(request.commandType());
        }
        if (request.enabled() != null) {
            rule.setEnabled(request.enabled());
        }
        rule.setUpdatedAt(LocalDateTime.now());
        ruleRepository.save(rule);
        return toResponse(rule);
    }

    @Transactional
    public void toggleEnabled(Long id, boolean enabled) {
        ScheduleRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("定时规则不存在: id=" + id));
        rule.setEnabled(enabled);
        rule.setUpdatedAt(LocalDateTime.now());
        ruleRepository.save(rule);
    }

    @Transactional
    public void delete(Long id) {
        ruleRepository.deleteById(id);
    }

    public List<ScheduleExecutionLog> getExecutionLogs(Long ruleId) {
        return executionLogRepository.findByRuleIdOrderByExecutedAtDesc(ruleId);
    }

    private ScheduleRuleResponse toResponse(ScheduleRule rule) {
        return new ScheduleRuleResponse(
                rule.getId(),
                rule.getDeviceId(),
                rule.getRuleName(),
                rule.getTurnOnTime().format(TIME_FMT),
                rule.getTurnOffTime().format(TIME_FMT),
                rule.isEnabled(),
                rule.getRepeatMode(),
                rule.getCommandType(),
                rule.getCreatedAt() == null ? null : rule.getCreatedAt().format(DATETIME_FMT)
        );
    }
}
