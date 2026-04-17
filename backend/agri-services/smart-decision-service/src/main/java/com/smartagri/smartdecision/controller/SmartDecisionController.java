package com.smartagri.smartdecision.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.smartdecision.dto.DecisionRequest;
import com.smartagri.smartdecision.dto.DecisionResponse;
import com.smartagri.smartdecision.graph.DecisionGraphFactory;
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

    /**
     * 执行智能决策（自动意图分类 → 场景决策）
     */
    @PostMapping("/decide")
    public ApiResponse<DecisionResponse> decide(@Valid @RequestBody DecisionRequest request) {
        return ApiResponse.success(graphFactory.execute(request));
    }

    /**
     * 获取支持的 8 个决策场景列表
     */
    @GetMapping("/scenarios")
    public ApiResponse<List<Map<String, String>>> scenarios() {
        return ApiResponse.success(graphFactory.listScenarios());
    }
}
