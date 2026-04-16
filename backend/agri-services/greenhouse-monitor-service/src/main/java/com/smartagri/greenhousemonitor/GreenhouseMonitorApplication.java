package com.smartagri.greenhousemonitor;

import com.smartagri.greenhousemonitor.config.GreenhouseMonitorProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(GreenhouseMonitorProperties.class)
public class GreenhouseMonitorApplication {

    public static void main(String[] args) {
        SpringApplication.run(GreenhouseMonitorApplication.class, args);
    }
}
