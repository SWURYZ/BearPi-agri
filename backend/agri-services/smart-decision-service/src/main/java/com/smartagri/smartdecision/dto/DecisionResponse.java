package com.smartagri.smartdecision.dto;

public record DecisionResponse(
        String scenario,
        String scenarioLabel,
        String decision,
        SensorSnapshot sensorSnapshot,
        String graphTrace
) {}
