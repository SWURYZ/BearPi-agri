package com.smartagri.historicalanalysis.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashMap;
import java.util.Map;

@Getter
@Setter
@ConfigurationProperties(prefix = "historical-analysis")
public class HistoricalAnalysisProperties {

    private int maxPoints = 240;

    private Map<String, String> greenhouseDeviceMap = new LinkedHashMap<>();
}
