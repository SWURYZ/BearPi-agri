package com.smartagri.smoke.service;

import com.smartagri.api.smoke.dto.ComponentCheck;
import com.smartagri.api.smoke.dto.SmokeCheckResponse;
import com.smartagri.smoke.config.StackProbeProperties;
import com.smartagri.smoke.mapper.SmokeMapper;
import lombok.RequiredArgsConstructor;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisConnectionCommands;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import javax.sql.DataSource;
import java.net.URI;
import java.sql.Connection;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

@Service
@RequiredArgsConstructor
public class StackProbeService {

    private final Environment environment;
    private final StackProbeProperties properties;
    private final SmokeMapper smokeMapper;
    private final DataSource dataSource;
    private final RedisConnectionFactory redisConnectionFactory;

    public SmokeCheckResponse probe() {
        List<ComponentCheck> checks = new ArrayList<>();
        checks.add(checkDatabase());
        checks.add(checkRedis());
        checks.add(checkKafka());
        checks.add(checkMqtt());
        checks.add(checkNacos());
        checks.add(checkOpenApi());

        return new SmokeCheckResponse(
                environment.getProperty("spring.application.name", "tech-stack-smoke-service"),
                environment.getActiveProfiles().length == 0 ? "default" : String.join(",", environment.getActiveProfiles()),
                OffsetDateTime.now(),
                checks
        );
    }

    private ComponentCheck checkDatabase() {
        if (!properties.isEnableDatabaseCheck()) {
            return skipped("postgresql + mybatis-plus + flyway", "Database check is disabled");
        }

        Connection connection = DataSourceUtils.getConnection(dataSource);
        try {
            Integer result = smokeMapper.selectOne();
            String database = connection.getMetaData().getDatabaseProductName();
            return up("postgresql + mybatis-plus + flyway", "Connected to " + database + ", select result=" + result);
        } catch (Exception ex) {
            return down("postgresql + mybatis-plus + flyway", ex);
        } finally {
            DataSourceUtils.releaseConnection(connection, dataSource);
        }
    }

    private ComponentCheck checkRedis() {
        if (!properties.isEnableRedisCheck()) {
            return skipped("redis", "Redis check is disabled");
        }

        try (var connection = redisConnectionFactory.getConnection()) {
            RedisConnectionCommands commands = connection;
            String pong = commands.ping();
            return up("redis", "Ping result=" + pong);
        } catch (Exception ex) {
            return down("redis", ex);
        }
    }

    private ComponentCheck checkKafka() {
        if (!properties.isEnableKafkaCheck()) {
            return skipped("kafka", "Kafka check is disabled");
        }

        Properties config = new Properties();
        config.put("bootstrap.servers", properties.getKafkaBootstrapServers());

        try (var admin = org.apache.kafka.clients.admin.AdminClient.create(config)) {
            var cluster = admin.describeCluster();
            String clusterId = cluster.clusterId().get();
            int nodes = cluster.nodes().get().size();
            return up("kafka", "ClusterId=" + clusterId + ", nodes=" + nodes);
        } catch (Exception ex) {
            return down("kafka", ex);
        }
    }

    private ComponentCheck checkMqtt() {
        if (!properties.isEnableMqttCheck()) {
            return skipped("mqtt", "MQTT check is disabled");
        }

        try {
            String clientId = properties.getMqttClientId() + "-" + System.currentTimeMillis();
            MqttClient client = new MqttClient(properties.getMqttUri(), clientId);
            try {
                MqttConnectOptions options = new MqttConnectOptions();
                options.setServerURIs(new String[]{properties.getMqttUri()});
                if (StringUtils.hasText(properties.getMqttUsername())) {
                    options.setUserName(properties.getMqttUsername());
                }
                if (StringUtils.hasText(properties.getMqttPassword())) {
                    options.setPassword(properties.getMqttPassword().toCharArray());
                }
                client.connect(options);
                client.disconnect();
            } finally {
                client.close();
            }
            return up("mqtt", "Connected to broker " + properties.getMqttUri());
        } catch (Exception ex) {
            return down("mqtt", ex);
        }
    }

    private ComponentCheck checkNacos() {
        if (!properties.isEnableNacosCheck()) {
            return skipped("nacos", "Nacos check is disabled");
        }

        try {
            String body = RestClient.create()
                    .get()
                    .uri(URI.create(properties.getNacosBaseUrl() + "/nacos/v1/console/health/liveness"))
                    .retrieve()
                    .body(String.class);
            return up("nacos", "Response=" + body);
        } catch (Exception ex) {
            return down("nacos", ex);
        }
    }

    private ComponentCheck checkOpenApi() {
        return up("openapi", "Swagger UI endpoint is exposed at /swagger-ui/index.html");
    }

    private ComponentCheck up(String name, String detail) {
        return new ComponentCheck(name, "UP", detail);
    }

    private ComponentCheck skipped(String name, String detail) {
        return new ComponentCheck(name, "SKIPPED", detail);
    }

    private ComponentCheck down(String name, Exception ex) {
        return new ComponentCheck(name, "DOWN", ex.getClass().getSimpleName() + ": " + ex.getMessage());
    }
}
