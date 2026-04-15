package com.smartagri.iotaccess.listener;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartagri.iotaccess.service.HuaweiIotCommandService;
import com.smartagri.iotaccess.service.TelemetryIngestionService;
import jakarta.jms.Message;
import jakarta.jms.TextMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class HuaweiAmqpMessageListener {

    private final ObjectMapper objectMapper;
    private final TelemetryIngestionService telemetryIngestionService;
    private final HuaweiIotCommandService commandService;

    public void onMessage(Message message) {
        String body = null;
        try {
            if (!(message instanceof TextMessage textMessage)) {
                log.info("忽略非文本 AMQP 消息: {}", message == null ? "null" : message.getClass().getName());
                return;
            }

            body = textMessage.getText();
            JsonNode root = objectMapper.readTree(body);
            String resource = root.path("resource").asText("");
            log.info("收到华为云 AMQP 消息, resource={}, body={}", resource, body);

            if ("device.command.status".equals(resource)) {
                JsonNode commandBody = root.path("notify_data").path("body");
                String commandId = commandBody.path("command_id").asText(null);
                String status = commandBody.path("status").asText(null);
                if (commandId != null && status != null) {
                    log.info("收到命令回执, commandId={}, status={}", commandId, status);
                    commandService.updateCommandStatus(commandId, status);
                } else {
                    log.warn("命令回执消息缺少 command_id 或 status, body={}", body);
                }
            } else {
                telemetryIngestionService.ingest(root);
            }
        } catch (Exception ex) {
            log.error("处理华为云 AMQP 消息失败, body={}", body, ex);
        } finally {
            try {
                message.acknowledge();
            } catch (Exception ackEx) {
                log.warn("确认 AMQP 消息失败", ackEx);
            }
        }
    }
}
