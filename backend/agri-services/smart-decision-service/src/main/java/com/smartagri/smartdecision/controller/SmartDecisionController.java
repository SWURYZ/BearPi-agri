package com.smartagri.smartdecision.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.smartdecision.dto.DecisionRequest;
import com.smartagri.smartdecision.dto.DecisionResponse;
import com.smartagri.smartdecision.dto.VoiceRuleRequest;
import com.smartagri.smartdecision.dto.VoiceRuleResponse;
import com.smartagri.smartdecision.graph.DecisionGraphFactory;
import com.smartagri.smartdecision.service.VoiceRuleParserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/smart-decision")
public class SmartDecisionController {

    private final DecisionGraphFactory graphFactory;
    private final VoiceRuleParserService voiceRuleParser;

    /**
     * 执行智能决策（自动意图分类 → 场景决策）
     */
    @PostMapping("/decide")
    public ApiResponse<DecisionResponse> decide(@Valid @RequestBody DecisionRequest request) {
        return ApiResponse.success(graphFactory.execute(request));
    }

    /**
     * 语音规则解析 —— 将自然语言规则指令解析为结构化参数（LLM 回退方案）
     */
    @PostMapping("/parse-voice-rule")
    public ApiResponse<VoiceRuleResponse> parseVoiceRule(@Valid @RequestBody VoiceRuleRequest request) {
        return ApiResponse.success(voiceRuleParser.parse(request.command()));
    }

    /**
     * 获取支持的 8 个决策场景列表
     */
    @GetMapping("/scenarios")
    public ApiResponse<List<Map<String, String>>> scenarios() {
        return ApiResponse.success(graphFactory.listScenarios());
    }
}
