package com.smartagri.smartdecision.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartagri.smartdecision.config.CozeProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.*;

@Slf4j
@Service
public class CozeLlmService {

    private final CozeProperties properties;
    private final ObjectMapper objectMapper;
    private final WebClient webClient;

    private static final ParameterizedTypeReference<ServerSentEvent<String>> SSE_TYPE =
            new ParameterizedTypeReference<>() {};

    public CozeLlmService(CozeProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder()
                .baseUrl(properties.getBaseUrl())
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(2 * 1024 * 1024))
                .defaultHeaders(h -> {
                    h.setBearerAuth(properties.getPat());
                    h.setContentType(MediaType.APPLICATION_JSON);
                    h.setAccept(List.of(MediaType.TEXT_EVENT_STREAM));
                })
                .build();
    }

    /**
     * 向 Coze 发送问题并获取完整回答（阻塞调用，供 LangGraph 节点使用）
     */
    public String ask(String prompt) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("bot_id", properties.getBotId());
        payload.put("user_id", "smart-decision-" + UUID.randomUUID());
        payload.put("stream", true);
        payload.put("auto_save_history", false);
        payload.put("additional_messages", List.of(Map.of(
                "role", "user",
                "content", prompt,
                "content_type", "text"
        )));

        try {
            String result = webClient.post()
                    .uri(properties.getChatPath())
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToFlux(SSE_TYPE)
                    .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                    .mapNotNull(this::extractAnswerContent)
                    .reduce(new StringBuilder(), StringBuilder::append)
                    .map(StringBuilder::toString)
                    .block();
            return (result != null && !result.isBlank()) ? result : "[未获取到LLM回复]";
        } catch (Exception ex) {
            log.error("Coze API调用失败", ex);
            return "[LLM调用失败: " + ex.getMessage() + "]";
        }
    }

    private String extractAnswerContent(ServerSentEvent<String> event) {
        String data = event.data();
        if (data == null || data.isBlank() || "[DONE]".equalsIgnoreCase(data.trim())) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(data.trim());
            String type = root.path("type").asText("");
            if ("answer".equalsIgnoreCase(type)) {
                String content = root.path("content").asText(null);
                if (content != null && !content.isEmpty()) {
                    return content;
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
