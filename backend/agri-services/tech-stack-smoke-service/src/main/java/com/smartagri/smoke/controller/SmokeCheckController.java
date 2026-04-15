package com.smartagri.smoke.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.smoke.service.StackProbeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/smoke")
@RequiredArgsConstructor
public class SmokeCheckController {

    private final StackProbeService stackProbeService;

    @GetMapping("/check")
    public ApiResponse<?> check() {
        return ApiResponse.success(stackProbeService.probe());
    }
}
