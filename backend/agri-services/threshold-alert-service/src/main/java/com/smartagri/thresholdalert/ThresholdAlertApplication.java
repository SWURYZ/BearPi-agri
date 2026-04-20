package com.smartagri.thresholdalert;

import com.smartagri.thresholdalert.config.ThresholdAlertProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(ThresholdAlertProperties.class)
public class ThresholdAlertApplication {

    public static void main(String[] args) {
        SpringApplication.run(ThresholdAlertApplication.class, args);
    }
}
