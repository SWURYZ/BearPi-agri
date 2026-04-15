package com.smartagri.iotaccess;

import com.smartagri.iotaccess.config.HuaweiIotProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(HuaweiIotProperties.class)
public class IotAccessApplication {

    public static void main(String[] args) {
        SpringApplication.run(IotAccessApplication.class, args);
    }
}
