package com.smartagri.lightschedule;

import com.smartagri.lightschedule.config.LightScheduleProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(LightScheduleProperties.class)
public class LightScheduleApplication {

    public static void main(String[] args) {
        SpringApplication.run(LightScheduleApplication.class, args);
    }
}
