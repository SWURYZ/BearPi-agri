package com.smartagri.historicalanalysis;

import com.smartagri.historicalanalysis.config.HistoricalAnalysisProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(HistoricalAnalysisProperties.class)
public class HistoricalAnalysisApplication {

    public static void main(String[] args) {
        SpringApplication.run(HistoricalAnalysisApplication.class, args);
    }
}
