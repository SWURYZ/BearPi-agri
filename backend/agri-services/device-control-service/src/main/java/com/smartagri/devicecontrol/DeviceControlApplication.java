package com.smartagri.devicecontrol;

import com.smartagri.devicecontrol.config.DeviceControlProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(DeviceControlProperties.class)
public class DeviceControlApplication {

    public static void main(String[] args) {
        SpringApplication.run(DeviceControlApplication.class, args);
    }
}
