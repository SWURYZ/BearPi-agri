package com.smartagri.smoke;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.smartagri.smoke.config.StackProbeProperties;

@MapperScan("com.smartagri.smoke.mapper")
@SpringBootApplication
@EnableConfigurationProperties(StackProbeProperties.class)
public class TechStackSmokeApplication {

    public static void main(String[] args) {
        SpringApplication.run(TechStackSmokeApplication.class, args);
    }
}
