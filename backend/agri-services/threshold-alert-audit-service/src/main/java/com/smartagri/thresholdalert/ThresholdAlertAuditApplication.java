package com.smartagri.thresholdalert;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ThresholdAlertAuditApplication {

    public static void main(String[] args) {
        SpringApplication.run(ThresholdAlertAuditApplication.class, args);
    }
}
