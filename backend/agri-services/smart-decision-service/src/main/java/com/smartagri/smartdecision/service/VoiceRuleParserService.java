package com.smartagri.smartdecision.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartagri.smartdecision.dto.VoiceRuleResponse;
import com.smartagri.smartdecision.dto.VoiceRuleResponse.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 语音规则解析服务 —— 调用 Coze LLM 将自然语言规则指令解析为结构化参数。
 * <p>
 * 用于前端本地正则无法解析的复杂语音指令回退处理。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoiceRuleParserService {

    private final CozeLlmService llm;
    private final ObjectMapper objectMapper;

    private static final String PARSE_PROMPT = """
            你是一个智慧农业语音指令解析器。农户通过语音口语化地说了一条规则指令，请将其解析为结构化JSON。

            **重要**：农户说话很口语化、不会用专业术语，你需要理解意图而非死扣字面。例如：
            - "太热了开风扇" → LINKAGE规则，温度GT某个合理默认值(如35度)，开启风机
            - "天黑了帮我把灯打开" → LINKAGE规则，光照LT某个合理默认值(如200lux)，开启补光灯
            - "帮我中午通通风" → SCHEDULE规则，12:00~13:00开启风机
            - "湿度太低提醒我" → THRESHOLD规则，湿度BELOW某个合理默认值(如30%%)
            - "每天傍晚开灯到晚上九点" → SCHEDULE规则，18:00~21:00开启补光灯
            - "白天不要开灯" → SCHEDULE规则，06:00~18:00关闭补光灯
            - "干了浇水提醒我" → THRESHOLD规则，湿度BELOW 30%%

            如果农户没有给出具体数值，请根据农业常识填入合理默认值：
            - 温度过高：35°C    温度过低：10°C
            - 湿度过高：85%%    湿度过低：30%%
            - 光照过强：50000lux  光照不足：200lux

            如果农户没有给出具体时间段，请根据语境推测合理时间。

            规则类型说明：
            1. SCHEDULE - 定时规则：包含明确或可推测的时间段
            2. LINKAGE - 联动规则：传感器条件触发设备动作
            3. THRESHOLD - 阈值告警：传感器阈值触发报警/通知

            设备类型只有两种：
            - LIGHT_CONTROL：补光灯/灯/灯光/照明
            - MOTOR_CONTROL：风机/风扇/电机/马达/通风/排风/换气

            传感器指标只有三种：
            - temperature：温度（热、冷、闷热等）
            - humidity：湿度（干、湿、潮湿、缺水等）
            - luminance：光照（暗、亮、天黑、天亮等）

            用户指令：%s

            请严格按照以下JSON格式返回，不要返回任何其他内容：
            {
              "ruleType": "SCHEDULE或LINKAGE或THRESHOLD",
              "ruleName": "简短的规则名称",
              "schedule": {
                "turnOnTime": "HH:mm格式",
                "turnOffTime": "HH:mm格式",
                "commandType": "LIGHT_CONTROL或MOTOR_CONTROL"
              },
              "linkage": {
                "conditions": [
                  { "sensorMetric": "temperature或humidity或luminance", "operator": "GT或GTE或LT或LTE", "threshold": 数值 }
                ],
                "logicOperator": "AND",
                "commandType": "LIGHT_CONTROL或MOTOR_CONTROL",
                "commandAction": "ON或OFF"
              },
              "threshold": {
                "metric": "temperature或humidity或luminance",
                "operator": "ABOVE或BELOW",
                "threshold": 数值
              },
              "explanation": "用口语描述这条规则的含义"
            }

            注意：只填写对应ruleType的字段，其余类型的字段设为null。""";

    /**
     * 解析语音规则指令
     */
    public VoiceRuleResponse parse(String command) {
        String prompt = String.format(PARSE_PROMPT, command);
        String response = llm.ask(prompt);
        log.info("语音规则LLM原始响应: {}", response);

        try {
            // 提取 JSON 部分（LLM 可能包裹在 markdown code block 中）
            String json = extractJson(response);
            JsonNode root = objectMapper.readTree(json);

            String ruleType = root.path("ruleType").asText("SCHEDULE");
            String ruleName = root.path("ruleName").asText("语音创建规则");
            String explanation = root.path("explanation").asText("");

            ScheduleParams schedule = null;
            LinkageParams linkage = null;
            ThresholdParams threshold = null;

            if ("SCHEDULE".equals(ruleType) && root.has("schedule") && !root.get("schedule").isNull()) {
                JsonNode s = root.get("schedule");
                schedule = new ScheduleParams(
                        s.path("turnOnTime").asText(),
                        s.path("turnOffTime").asText(),
                        s.path("commandType").asText("LIGHT_CONTROL")
                );
            }

            if ("LINKAGE".equals(ruleType) && root.has("linkage") && !root.get("linkage").isNull()) {
                JsonNode l = root.get("linkage");
                List<ConditionParam> conditions = new ArrayList<>();
                if (l.has("conditions") && l.get("conditions").isArray()) {
                    for (JsonNode c : l.get("conditions")) {
                        conditions.add(new ConditionParam(
                                c.path("sensorMetric").asText(),
                                c.path("operator").asText(),
                                c.path("threshold").asDouble()
                        ));
                    }
                }
                linkage = new LinkageParams(
                        conditions,
                        l.path("logicOperator").asText("AND"),
                        l.path("commandType").asText("LIGHT_CONTROL"),
                        l.path("commandAction").asText("ON")
                );
            }

            if ("THRESHOLD".equals(ruleType) && root.has("threshold") && !root.get("threshold").isNull()) {
                JsonNode t = root.get("threshold");
                threshold = new ThresholdParams(
                        t.path("metric").asText(),
                        t.path("operator").asText(),
                        t.path("threshold").asDouble()
                );
            }

            return new VoiceRuleResponse(ruleType, ruleName, schedule, linkage, threshold, explanation);

        } catch (Exception ex) {
            log.error("解析LLM规则响应失败: {}", response, ex);
            return new VoiceRuleResponse("UNKNOWN", "解析失败", null, null, null,
                    "无法解析语音指令，请尝试更明确的表达，如：下午两点到四点开启补光灯");
        }
    }

    /**
     * 从可能包含 markdown 代码块的文本中提取 JSON
     */
    private String extractJson(String text) {
        if (text == null || text.isBlank()) return "{}";
        // 尝试提取 ```json ... ``` 包裹的内容
        int start = text.indexOf("```json");
        if (start >= 0) {
            start = text.indexOf('\n', start) + 1;
            int end = text.indexOf("```", start);
            if (end > start) return text.substring(start, end).trim();
        }
        // 尝试提取 ``` ... ``` 包裹的内容
        start = text.indexOf("```");
        if (start >= 0) {
            start = text.indexOf('\n', start) + 1;
            int end = text.indexOf("```", start);
            if (end > start) return text.substring(start, end).trim();
        }
        // 尝试提取第一个 { ... } 块
        start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) return text.substring(start, end + 1);
        return text.trim();
    }
}
