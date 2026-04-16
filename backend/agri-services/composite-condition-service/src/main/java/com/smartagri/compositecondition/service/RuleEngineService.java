package com.smartagri.compositecondition.service;

import com.smartagri.compositecondition.domain.entity.CompositeRule;
import com.smartagri.compositecondition.domain.entity.RuleCondition;
import com.smartagri.compositecondition.domain.entity.SensorLatestData;
import com.smartagri.compositecondition.domain.repository.CompositeRuleRepository;
import com.smartagri.compositecondition.domain.repository.SensorLatestDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 规则引擎 – 定时扫描所有启用规则，匹配最新传感器数据，命中后触发联动
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleEngineService {

    private final CompositeRuleRepository ruleRepository;
    private final SensorLatestDataRepository sensorDataRepository;
    private final LinkageDispatchService dispatchService;

    /**
     * 每 10 秒执行一次规则匹配
     */
    @Scheduled(fixedDelayString = "${rule.engine.scan-interval-ms:10000}")
    @Transactional(readOnly = true)
    public void scan() {
        List<CompositeRule> enabledRules = ruleRepository.findByEnabled(true);
        if (enabledRules.isEmpty()) {
            return;
        }

        for (CompositeRule rule : enabledRules) {
            try {
                evaluateRule(rule);
            } catch (Exception ex) {
                log.error("[规则引擎] 规则评估异常, ruleId={}", rule.getId(), ex);
            }
        }
    }

    private void evaluateRule(CompositeRule rule) {
        List<RuleCondition> conditions = rule.getConditions();
        if (conditions.isEmpty()) {
            return;
        }

        Map<String, Double> snapshot = new HashMap<>();
        boolean allMet;

        if ("AND".equalsIgnoreCase(rule.getLogicOperator())) {
            allMet = conditions.stream().allMatch(c -> checkCondition(c, snapshot));
        } else {
            // OR 逻辑
            allMet = conditions.stream().anyMatch(c -> checkCondition(c, snapshot));
        }

        if (allMet) {
            // Guard against race: user may disable rule between scan query and dispatch time.
            if (!ruleRepository.existsByIdAndEnabledTrue(rule.getId())) {
                log.info("[规则引擎] 规则已禁用，跳过下发, ruleId={}", rule.getId());
                return;
            }
            log.info("[规则引擎] 规则命中, ruleId={}, ruleName={}, targetDevice={}",
                    rule.getId(), rule.getName(), rule.getTargetDeviceId());
            String snapshotJson = dispatchService.toJson(snapshot);
            dispatchService.dispatch(
                    rule.getId(),
                    rule.getName(),
                    snapshotJson,
                    rule.getTargetDeviceId(),
                    rule.getCommandType(),
                    rule.getCommandAction()
            );
        }
    }

    private boolean checkCondition(RuleCondition condition, Map<String, Double> snapshot) {
        Optional<SensorLatestData> dataOpt = sensorDataRepository
                .findByDeviceIdAndMetric(condition.getSourceDeviceId(), condition.getSensorMetric());

        if (dataOpt.isEmpty()) {
            // 数据不存在视为不满足
            return false;
        }

        double currentValue = dataOpt.get().getValue();
        snapshot.put(condition.getSourceDeviceId() + "#" + condition.getSensorMetric(), currentValue);

        double threshold = condition.getThreshold();
        return switch (condition.getOperator()) {
            case "GT"  -> currentValue >  threshold;
            case "GTE" -> currentValue >= threshold;
            case "LT"  -> currentValue <  threshold;
            case "LTE" -> currentValue <= threshold;
            case "EQ"  -> Double.compare(currentValue, threshold) == 0;
            case "NEQ" -> Double.compare(currentValue, threshold) != 0;
            default    -> false;
        };
    }
}
