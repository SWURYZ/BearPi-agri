package com.smartagri.greenhousemonitor.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "huaweicloud.iotda")
public class GreenhouseMonitorProperties {

    private String ak;
    private String sk;
    private String projectId;
    private String region = "cn-north-4";
    private String endpoint;
    private boolean commandEnabled = true;
}
