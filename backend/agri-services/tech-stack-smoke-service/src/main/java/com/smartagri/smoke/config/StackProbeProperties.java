package com.smartagri.smoke.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.stack-check")
public class StackProbeProperties {

    private boolean enableDatabaseCheck = false;
    private boolean enableRedisCheck = false;
    private boolean enableKafkaCheck = false;
    private boolean enableMqttCheck = false;
    private boolean enableNacosCheck = false;

    private String kafkaBootstrapServers = "127.0.0.1:9092";
    private String nacosBaseUrl = "http://127.0.0.1:8848";
    private String mqttUri = "tcp://127.0.0.1:1883";
    private String mqttUsername = "admin";
    private String mqttPassword = "public";
    private String mqttClientId = "tech-stack-smoke-service";
}
