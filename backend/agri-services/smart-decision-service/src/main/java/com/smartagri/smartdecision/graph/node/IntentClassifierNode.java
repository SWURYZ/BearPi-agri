package com.smartagri.smartdecision.graph.node;

import com.smartagri.smartdecision.graph.DecisionState;
import com.smartagri.smartdecision.graph.Scenario;
import com.smartagri.smartdecision.service.CozeLlmService;
import org.bsc.langgraph4j.action.NodeAction;

import java.util.Map;

/**
 * 意图分类节点 —— 调用 Coze LLM 将用户自然语言问题路由到 8 个业务场景之一。
 * <p>
 * 若请求已通过 API 参数直接指定场景，则跳过 LLM 分类。
 */
public class IntentClassifierNode implements NodeAction<DecisionState> {

    private static final String CLASSIFY_PROMPT = """
            你是一个智慧农业意图分类器。根据用户的问题，判断属于以下哪个场景：
            1. IRRIGATION - 灌溉相关（浇水、土壤湿度、需水量等）
            2. LIGHT - 补光相关（光照、补光灯、日照不足等）
            3. VENTILATION - 通风降温相关（通风、风扇、散热、除湿等）
            4. TEMPERATURE - 温度调控相关（温度过高/过低、升温降温等）
            5. PEST - 病虫害预警相关（病虫害、防治、杀虫、消毒等）
            6. FERTILIZATION - 施肥相关（施肥、追肥、肥料配比等）
            7. HARVEST - 采收时机相关（采收、收获、成熟度等）
            8. ANOMALY - 异常告警相关（异常、报警、设备故障、数据异常等）

            用户问题：%s

            请只返回场景英文代号（如 IRRIGATION），不要返回其他内容。""";

    private final CozeLlmService llm;

    public IntentClassifierNode(CozeLlmService llm) {
        this.llm = llm;
    }

    @Override
    public Map<String, Object> apply(DecisionState state) {
        // 用户直接指定了场景则跳过 LLM 分类
        String requested = state.requestedScenario();
        if (!requested.isBlank()) {
            Scenario s = Scenario.fromName(requested);
            return Map.of(
                    "intent", s.name().toLowerCase(),
                    "scenario_label", s.label(),
                    "graph_trace", "classify_intent(直接指定:" + s.name() + ")"
            );
        }

        // 调用 Coze 进行意图分类
        String response = llm.ask(String.format(CLASSIFY_PROMPT, state.query()));
        Scenario classified = parseScenario(response);
        return Map.of(
                "intent", classified.name().toLowerCase(),
                "scenario_label", classified.label(),
                "graph_trace", "classify_intent(" + classified.name() + ")"
        );
    }

    private Scenario parseScenario(String response) {
        if (response == null || response.isBlank()) return Scenario.ANOMALY;
        String cleaned = response.trim().toUpperCase().replaceAll("[^A-Z_]", "");
        return Scenario.fromName(cleaned);
    }
}
