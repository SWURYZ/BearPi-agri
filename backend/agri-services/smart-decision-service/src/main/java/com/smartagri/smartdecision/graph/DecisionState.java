package com.smartagri.smartdecision.graph;

import org.bsc.langgraph4j.state.AgentState;
import org.bsc.langgraph4j.state.Channel;

import java.util.Map;
import java.util.Optional;

/**
 * LangGraph 智能决策工作流状态
 *
 * 包含用户查询、传感器上下文、意图分类结果、决策输出等流转数据。
 */
public class DecisionState extends AgentState {

    static final Map<String, Channel<?>> SCHEMA = Map.of();

    public DecisionState(Map<String, Object> initData) {
        super(initData);
    }

    /* ---------- 输入字段 ---------- */

    public String query() {
        return stringVal("query");
    }

    public String sensorContext() {
        return stringVal("sensor_context");
    }

    public String requestedScenario() {
        return stringVal("requested_scenario");
    }

    /* ---------- 流转字段 ---------- */

    public String intent() {
        return Optional.ofNullable(stringVal("intent")).orElse("anomaly");
    }

    public String scenarioLabel() {
        return stringVal("scenario_label");
    }

    /* ---------- 输出字段 ---------- */

    public String decision() {
        return stringVal("decision");
    }

    public String graphTrace() {
        return stringVal("graph_trace");
    }

    /* ---------- 辅助 ---------- */

    private String stringVal(String key) {
        return this.<String>value(key).orElse("");
    }
}
