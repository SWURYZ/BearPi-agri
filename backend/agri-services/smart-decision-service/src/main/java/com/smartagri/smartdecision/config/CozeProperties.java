package com.smartagri.smartdecision.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "coze.api")
public class CozeProperties {
    private String baseUrl;
    private String chatPath;
    private String botId;
    private String pat;
    private int timeoutSeconds = 60;
}
