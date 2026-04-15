package com.smartagri.iotaccess.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "huaweicloud.iotda")
public class HuaweiIotProperties {

    private String ak = "HPUASOFYRYK6SXUL0I7X";
    private String sk = "zcpB6oZt2jhINGSwmwHG013Ub7NxrxMw4k0Wfn7g";
    private String projectId = "ed1e23a0e3734fc082cbcf11e6855e91";
    private String region = "cn-north-4";
    private String endpoint = "https://6c48cc4953.st1.iotda-app.cn-north-4.myhuaweicloud.com";
    private boolean commandEnabled = true;
    private final Amqp amqp = new Amqp();

    @Getter
    @Setter
    public static class Amqp {
        private boolean enabled = true;
        private String url = "amqps://6c48cc4953.st1.iotda-app.cn-north-4.myhuaweicloud.com:5671?amqp.vhost=default&amqp.idleTimeout=120000&amqp.saslMechanisms=PLAIN";
        private String accessKey = "3TESt7hB";
        private String accessCode = "HDIfDVKjVtuz2JT5IM5lUCxzV9l8N1cA";
        private String queueId = "c4a324ba-299d-4b41-82e9-65c0d0af1eab";
        private String queueName = "bearpi-update";
    }
}
