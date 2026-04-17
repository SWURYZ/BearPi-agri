package com.smartagri.smartdecision.graph.node;

import com.smartagri.smartdecision.graph.DecisionState;
import com.smartagri.smartdecision.graph.Scenario;
import com.smartagri.smartdecision.service.CozeLlmService;
import org.bsc.langgraph4j.action.NodeAction;

import java.util.Map;

/**
 * 通用场景决策节点 —— 以 {@link Scenario} 枚举参数化。
 * <p>
 * 每个实例对应一个业务场景（灌溉/补光/通风/…），
 * 使用场景专属 Prompt + 传感器上下文调用 Coze LLM 获取决策建议。
 */
public class ScenarioDecisionNode implements NodeAction<DecisionState> {

    private final Scenario scenario;
    private final CozeLlmService llm;

    public ScenarioDecisionNode(Scenario scenario, CozeLlmService llm) {
        this.scenario = scenario;
        this.llm = llm;
    }

    @Override
    public Map<String, Object> apply(DecisionState state) {
        String prompt = scenario.buildPrompt(state.sensorContext(), state.query());
        String decision = llm.ask(prompt);

        String trace = state.graphTrace();
        if (!trace.isBlank()) {
            trace = trace + " → " + scenario.name().toLowerCase();
        } else {
            trace = scenario.name().toLowerCase();
        }

        return Map.of(
                "decision", decision,
                "graph_trace", trace
        );
    }
}
