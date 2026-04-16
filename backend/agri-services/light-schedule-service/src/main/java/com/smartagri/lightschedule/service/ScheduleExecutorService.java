package com.smartagri.lightschedule.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huaweicloud.sdk.core.auth.AbstractCredentials;
import com.huaweicloud.sdk.core.auth.BasicCredentials;
import com.huaweicloud.sdk.core.exception.ServiceResponseException;
import com.huaweicloud.sdk.core.region.Region;
import com.huaweicloud.sdk.iotda.v5.IoTDAClient;
import com.huaweicloud.sdk.iotda.v5.model.CreateMessageRequest;
import com.huaweicloud.sdk.iotda.v5.model.CreateMessageResponse;
import com.huaweicloud.sdk.iotda.v5.model.DeviceMessageRequest;
import com.smartagri.lightschedule.config.LightScheduleProperties;
import com.smartagri.lightschedule.domain.entity.ScheduleExecutionLog;
import com.smartagri.lightschedule.domain.entity.ScheduleRule;
import com.smartagri.lightschedule.domain.repository.ScheduleExecutionLogRepository;
import com.smartagri.lightschedule.domain.repository.ScheduleRuleRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleExecutorService {

    private final LightScheduleProperties properties;
    private final ScheduleRuleRepository ruleRepository;
    private final ScheduleExecutionLogRepository executionLogRepository;
    private final ObjectMapper objectMapper;

    private IoTDAClient client;

    @PostConstruct
    void init() {
        if (!properties.isCommandEnabled()) {
            return;
        }
        if (!StringUtils.hasText(properties.getAk())
                || !StringUtils.hasText(properties.getSk())
                || !StringUtils.hasText(properties.getProjectId())) {
            return;
        }

        BasicCredentials credentials = new BasicCredentials()
                .withDerivedPredicate(AbstractCredentials.DEFAULT_DERIVED_PREDICATE)
                .withAk(properties.getAk().trim())
                .withSk(properties.getSk().trim())
                .withProjectId(properties.getProjectId().trim());

        this.client = IoTDAClient.newBuilder()
                .withCredential(credentials)
                .withRegion(resolveRegion())
                .build();
    }

    /**
     * 每分钟扫描一次，检查是否有定时规则到达执行时间点
     */
    @Scheduled(cron = "0 * * * * *")
    public void scanAndExecute() {
        LocalTime now = LocalTime.now().withSecond(0).withNano(0);
        List<ScheduleRule> enabledRules = ruleRepository.findByEnabledTrue();

        for (ScheduleRule rule : enabledRules) {
            LocalTime onTime = rule.getTurnOnTime().withSecond(0).withNano(0);
            LocalTime offTime = rule.getTurnOffTime().withSecond(0).withNano(0);

            if (now.equals(onTime) && !isAlreadyExecutedThisMinute(rule.getId(), "ON")) {
                log.info("定时开启触发, ruleId={}, deviceId={}, commandType={}, time={}", rule.getId(), rule.getDeviceId(), rule.getCommandType(), now);
                dispatchCommand(rule, "ON");
            } else if (now.equals(offTime) && !isAlreadyExecutedThisMinute(rule.getId(), "OFF")) {
                log.info("定时关闭触发, ruleId={}, deviceId={}, commandType={}, time={}", rule.getId(), rule.getDeviceId(), rule.getCommandType(), now);
                dispatchCommand(rule, "OFF");
            }
        }
    }

    private void dispatchCommand(ScheduleRule rule, String action) {
        ScheduleExecutionLog executionLog = new ScheduleExecutionLog();
        executionLog.setRuleId(rule.getId());
        executionLog.setDeviceId(rule.getDeviceId());
        executionLog.setAction(action);

        if (!properties.isCommandEnabled() || client == null) {
            executionLog.setStatus("SKIPPED");
            executionLog.setErrorMessage("Command dispatch is disabled or IoT client not initialized");
            executionLogRepository.save(executionLog);
            return;
        }

        String commandType = rule.getCommandType() == null ? "LIGHT_CONTROL" : rule.getCommandType();
        Map<String, Object> payload;
        if ("MOTOR_CONTROL".equals(commandType)) {
            payload = Map.of("motor", action);
        } else {
            payload = Map.of("led", action);
        }
        DeviceMessageRequest body = new DeviceMessageRequest();
        body.setMessage(payload);

        CreateMessageRequest cloudRequest = new CreateMessageRequest()
                .withDeviceId(rule.getDeviceId())
                .withBody(body);

        try {
            CreateMessageResponse response = client.createMessage(cloudRequest);
            executionLog.setCloudMessageId(response.getMessageId());
            executionLog.setStatus("SENT");
            executionLogRepository.save(executionLog);
            log.info("定时指令已下发, deviceId={}, commandType={}, action={}, messageId={}",
                    rule.getDeviceId(), rule.getCommandType(), action, response.getMessageId());
        } catch (ServiceResponseException ex) {
            executionLog.setStatus("FAILED");
            executionLog.setErrorMessage("[" + ex.getErrorCode() + "] " + ex.getErrorMsg());
            executionLogRepository.save(executionLog);
            log.error("定时指令下发失败, deviceId={}, error={}", rule.getDeviceId(), executionLog.getErrorMessage());
        } catch (Exception ex) {
            executionLog.setStatus("FAILED");
            executionLog.setErrorMessage(ex.getClass().getSimpleName() + ": " + ex.getMessage());
            executionLogRepository.save(executionLog);
            log.error("定时指令下发异常, deviceId={}", rule.getDeviceId(), ex);
        }
    }

    private boolean isAlreadyExecutedThisMinute(Long ruleId, String action) {
        LocalDateTime oneMinuteAgo = LocalDateTime.now().minusSeconds(59);
        List<ScheduleExecutionLog> recentLogs = executionLogRepository
                .findByRuleIdAndActionAndExecutedAtAfter(ruleId, action, oneMinuteAgo);
        return !recentLogs.isEmpty();
    }

    private Region resolveRegion() {
        if (StringUtils.hasText(properties.getEndpoint())) {
            String endpoint = properties.getEndpoint().trim();
            if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
                endpoint = "https://" + endpoint;
            }
            return new Region(properties.getRegion().trim(), endpoint);
        }
        return new Region(properties.getRegion().trim(),
                "https://iotda." + properties.getRegion().trim() + ".myhuaweicloud.com");
    }
}
