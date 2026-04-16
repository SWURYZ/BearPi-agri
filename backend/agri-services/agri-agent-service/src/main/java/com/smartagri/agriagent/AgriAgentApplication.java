package com.smartagri.agriagent;

import com.smartagri.agriagent.config.CozeApiProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(CozeApiProperties.class)
public class AgriAgentApplication {

    public static void main(String[] args) {
        SpringApplication.run(AgriAgentApplication.class, args);
    }
}
