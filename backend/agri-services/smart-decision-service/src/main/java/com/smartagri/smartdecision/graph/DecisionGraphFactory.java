package com.smartagri.smartdecision.graph;

import com.smartagri.smartdecision.dto.DecisionRequest;
import com.smartagri.smartdecision.dto.DecisionResponse;
import com.smartagri.smartdecision.dto.SensorSnapshot;
import com.smartagri.smartdecision.graph.node.IntentClassifierNode;
import com.smartagri.smartdecision.graph.node.ScenarioDecisionNode;
import com.smartagri.smartdecision.service.CozeLlmService;
import com.smartagri.smartdecision.service.SensorDataService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.NodeOutput;
import org.bsc.langgraph4j.StateGraph;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.CompletableFuture;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;
import static org.bsc.langgraph4j.action.AsyncNodeAction.node_async;

/**
 * LangGraph4j 工作流工厂 —— 构建、编译并执行智能决策图。
 *
 * <pre>
 *   START → classify_intent → [条件路由] → irrigation / light / ventilation / temperature
 *                                           pest / fertilization / harvest / anomaly → END
 * </pre>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DecisionGraphFactory {

    private final CozeLlmService llm;
    private final SensorDataService sensorDataService;

    private CompiledGraph<DecisionState> compiledGraph;

    @PostConstruct
    void init() throws Exception {
        this.compiledGraph = buildGraph();
        log.info("智能决策 LangGraph 工作流编译完成，包含 {} 个业务场景节点", Scenario.values().length);
    }

    /* =========================================================
     *  图定义
     * ========================================================= */

    private CompiledGraph<DecisionState> buildGraph() throws Exception {
        var graph = new StateGraph<>(DecisionState.SCHEMA, DecisionState::new);

        // ① 意图分类节点
        graph.addNode("classify_intent", node_async(new IntentClassifierNode(llm)));

        // ② 8 个业务场景决策节点 + 路由映射
        Map<String, String> routeMap = new LinkedHashMap<>();
        for (Scenario scenario : Scenario.values()) {
            String nodeName = scenario.name().toLowerCase();
            graph.addNode(nodeName, node_async(new ScenarioDecisionNode(scenario, llm)));
            graph.addEdge(nodeName, END);
            routeMap.put(nodeName, nodeName);
        }

        // ③ 连线
        graph.addEdge(START, "classify_intent");
        graph.addConditionalEdges("classify_intent",
                state -> CompletableFuture.completedFuture(state.intent()),
                routeMap);

        return graph.compile();
    }

    /* =========================================================
     *  执行
     * ========================================================= */

    /**
     * 执行完整决策工作流：传感器采集 → 意图分类 → 场景决策
     */
    public DecisionResponse execute(DecisionRequest request) {
        // 预加载传感器快照
        SensorSnapshot sensors = sensorDataService.getLatest(request.deviceId());
        String sensorContext = sensorDataService.formatSensorContext(sensors);

        // 构建初始状态
        Map<String, Object> inputs = new HashMap<>();
        inputs.put("query", request.query());
        inputs.put("sensor_context", sensorContext);
        inputs.put("requested_scenario", Objects.toString(request.scenario(), ""));
        inputs.put("graph_trace", "");

        // 运行 LangGraph
        DecisionState finalState = null;
        try {
            for (NodeOutput<DecisionState> output : compiledGraph.stream(inputs)) {
                finalState = output.state();
                log.debug("LangGraph 节点 [{}] 执行完成", output.node());
            }
        } catch (Exception ex) {
            log.error("LangGraph 执行失败", ex);
            return new DecisionResponse("ERROR", "执行失败",
                    "决策工作流执行异常: " + ex.getMessage(), sensors, "");
        }

        if (finalState == null) {
            return new DecisionResponse("ERROR", "执行失败",
                    "决策工作流未产生结果", sensors, "");
        }

        return new DecisionResponse(
                finalState.intent().toUpperCase(),
                finalState.scenarioLabel(),
                finalState.decision(),
                sensors,
                finalState.graphTrace()
        );
    }

    /* =========================================================
     *  查询
     * ========================================================= */

    /**
     * 获取所有支持的决策场景
     */
    public List<Map<String, String>> listScenarios() {
        return Arrays.stream(Scenario.values())
                .map(s -> Map.of("code", s.name(), "label", s.label()))
                .toList();
    }
}
