package com.smartagri.compositecondition.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "huaweicloud.iotda")
public class CompositeConditionProperties {

    private String ak;
    private String sk;
    private String projectId;
    private String region = "cn-north-4";
    private String endpoint;
    private boolean commandEnabled = true;
}
