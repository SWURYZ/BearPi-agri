package com.smartagri.iotaccess.config;

import com.smartagri.iotaccess.listener.HuaweiAmqpMessageListener;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.jms.Connection;
import jakarta.jms.MessageConsumer;
import jakarta.jms.Queue;
import jakarta.jms.Session;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.qpid.jms.JmsConnectionFactory;
import org.apache.qpid.jms.transports.TransportOptions;
import org.apache.qpid.jms.transports.TransportSupport;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import javax.net.ssl.SSLContext;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class HuaweiAmqpConsumerConfig {

    private final HuaweiIotProperties properties;
    private final HuaweiAmqpMessageListener messageListener;

    private Connection connection;
    private Session session;
    private MessageConsumer consumer;

    @PostConstruct
    void init() {
        HuaweiIotProperties.Amqp amqp = properties.getAmqp();
        if (!amqp.isEnabled()
                || !StringUtils.hasText(amqp.getUrl())
                || !StringUtils.hasText(amqp.getAccessKey())
                || !StringUtils.hasText(amqp.getAccessCode())) {
            return;
        }

        try {
            JmsConnectionFactory factory = new JmsConnectionFactory();
            factory.setRemoteURI(amqp.getUrl());
            factory.setClientID("iot-access-" + System.currentTimeMillis());

            TransportOptions transportOptions = new TransportOptions();
            transportOptions.setTrustAll(true);
            SSLContext sslContext = TransportSupport.createJdkSslContext(transportOptions);
            factory.setSslContext(sslContext);

            String username = "accessKey=" + amqp.getAccessKey() + "|timestamp=" + System.currentTimeMillis();
            connection = factory.createConnection(username, amqp.getAccessCode());
            connection.start();

            session = connection.createSession(false, Session.CLIENT_ACKNOWLEDGE);
            Queue queue = session.createQueue(amqp.getQueueName());
            consumer = session.createConsumer(queue);
            consumer.setMessageListener(messageListener::onMessage);
            log.info("Huawei AMQP consumer started, queue={}", amqp.getQueueName());
        } catch (Exception ex) {
            log.error("Failed to start Huawei AMQP consumer", ex);
        }
    }

    @PreDestroy
    void destroy() {
        try {
            if (consumer != null) {
                consumer.close();
            }
            if (session != null) {
                session.close();
            }
            if (connection != null) {
                connection.close();
            }
        } catch (Exception ex) {
            log.warn("Failed to close Huawei AMQP consumer", ex);
        }
    }
}
