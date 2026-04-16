package com.smartagri.agriagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartagri.agriagent.config.CozeApiProperties;
import com.smartagri.agriagent.dto.AgriAgentChatRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CozeAgentService {

    private static final ParameterizedTypeReference<ServerSentEvent<String>> SSE_STRING_TYPE =
            new ParameterizedTypeReference<>() {
            };

    private final CozeApiProperties properties;
    private final ObjectMapper objectMapper;

    public Flux<AgentChunk> streamChat(AgriAgentChatRequest request) {
        validateConfig();

        WebClient webClient = WebClient.builder()
                .baseUrl(properties.getBaseUrl())
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(2 * 1024 * 1024))
                .defaultHeaders(headers -> {
                    headers.setBearerAuth(properties.getPat());
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    headers.setAccept(List.of(MediaType.TEXT_EVENT_STREAM));
                })
                .build();

        return webClient.post()
                .uri(properties.getChatPath())
                .bodyValue(buildPayload(request))
                .retrieve()
                .bodyToFlux(SSE_STRING_TYPE)
                .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                .concatMap(this::parseSseEvent)
                .onErrorResume(ex -> Flux.just(AgentChunk.error(ex.getMessage())));
    }

    public Mono<String> chat(AgriAgentChatRequest request) {
        return streamChat(request)
                .filter(chunk -> chunk.type() == AgentChunkType.TOKEN)
                .map(AgentChunk::content)
                .reduce(new StringBuilder(), StringBuilder::append)
                .map(StringBuilder::toString);
    }

    private Map<String, Object> buildPayload(AgriAgentChatRequest request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("bot_id", properties.getBotId());
        payload.put("user_id", StringUtils.hasText(request.userId()) ? request.userId() : "agri-web-" + UUID.randomUUID());
        payload.put("stream", true);
        payload.put("auto_save_history", true);

        if (StringUtils.hasText(request.conversationId())) {
            payload.put("conversation_id", request.conversationId());
        }

        payload.put("additional_messages", List.of(
                Map.of(
                        "role", "user",
                        "content", request.question(),
                        "content_type", "text"
                )
        ));

        return payload;
    }

    private Flux<AgentChunk> parseSseEvent(ServerSentEvent<String> event) {
        String sseEventName = event.event();

        // Skip conversation.message.completed to avoid duplicating streamed tokens
        if (sseEventName != null && sseEventName.contains("message.completed")) {
            return Flux.empty();
        }
        // conversation.chat.completed signals end of stream
        if (sseEventName != null && sseEventName.contains("chat.completed")) {
            return Flux.just(AgentChunk.done());
        }

        String data = event.data();
        if (!StringUtils.hasText(data)) {
            return Flux.empty();
        }

        String trimmed = data.trim();
        if ("[DONE]".equalsIgnoreCase(trimmed)) {
            return Flux.just(AgentChunk.done());
        }

        try {
            JsonNode root = objectMapper.readTree(trimmed);
            AgentChunk chunk = parseCozeNode(root);
            if (chunk != null) {
                return Flux.just(chunk);
            }
        } catch (Exception ignored) {
            if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
                return Flux.just(AgentChunk.token(fixPossibleMojibake(trimmed)));
            }
        }

        return Flux.empty();
    }

    private AgentChunk parseCozeNode(JsonNode node) {
        // --- Coze v3 conversation.message.delta format ---
        // { "type": "answer"|"reasoning", "content": "...", "reasoning_content": "..." }
        String nodeType = textNode(node, "/type");
        if (StringUtils.hasText(nodeType)) {
            String lt = nodeType.toLowerCase();
            if ("reasoning".equals(lt) || "thinking".equals(lt) || "verbose".equals(lt)) {
                String reasoning = firstNonBlank(textNode(node, "/reasoning_content"), textNode(node, "/content"), textNode(node, "/delta"));
                if (StringUtils.hasText(reasoning)) {
                    return AgentChunk.thinking(fixPossibleMojibake(reasoning));
                }
                return null;
            }
            if ("answer".equals(lt)) {
                String answer = firstNonBlank(textNode(node, "/content"), textNode(node, "/delta"), textNode(node, "/answer"));
                if (StringUtils.hasText(answer)) {
                    return AgentChunk.token(fixPossibleMojibake(answer));
                }
                return null;
            }
            if (lt.contains("completed") || lt.contains("finish")) {
                return AgentChunk.done();
            }
        }

        // --- Legacy / fallback msg_type format ---
        String msgType = textNode(node, "/msg_type");
        if (StringUtils.hasText(msgType)) {
            if ("generate_answer_finish".equalsIgnoreCase(msgType)) {
                return AgentChunk.done();
            }
            if ("answer".equalsIgnoreCase(msgType)) {
                String answer = firstNonBlank(textNode(node, "/content"), textNode(node, "/answer"), textNode(node, "/delta"));
                if (StringUtils.hasText(answer)) {
                    return AgentChunk.token(fixPossibleMojibake(answer));
                }
            }
            return null;
        }

        // --- event field fallback ---
        String eventType = textNode(node, "/event");
        if (StringUtils.hasText(eventType)) {
            String lowerType = eventType.toLowerCase();
            if (lowerType.contains("completed") || lowerType.contains("finish")) {
                return AgentChunk.done();
            }
            if (lowerType.contains("reasoning") || lowerType.contains("thinking")) {
                String reasoning = firstNonBlank(textNode(node, "/content"), textNode(node, "/reasoning_content"), textNode(node, "/delta"));
                if (StringUtils.hasText(reasoning)) {
                    return AgentChunk.thinking(fixPossibleMojibake(reasoning));
                }
            }
            if (lowerType.contains("delta") || lowerType.contains("answer")) {
                String answer = firstNonBlank(textNode(node, "/content"), textNode(node, "/delta"), textNode(node, "/answer"));
                if (StringUtils.hasText(answer)) {
                    return AgentChunk.token(fixPossibleMojibake(answer));
                }
            }
        }

        JsonNode dataNode = node.get("data");
        if (dataNode != null && !dataNode.isNull()) {
            if (dataNode.isObject()) {
                return parseCozeNode(dataNode);
            }
            if (dataNode.isTextual()) {
                String rawData = dataNode.asText();
                if (StringUtils.hasText(rawData) && (rawData.startsWith("{") || rawData.startsWith("["))) {
                    try {
                        return parseCozeNode(objectMapper.readTree(rawData));
                    } catch (Exception ignored) {
                        return null;
                    }
                }
            }
        }

        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private String textNode(JsonNode node, String pointer) {
        JsonNode candidate = node.at(pointer);
        if (candidate.isTextual()) {
            return candidate.asText();
        }
        return null;
    }

    private String fixPossibleMojibake(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }

        String repaired = new String(value.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8);
        int originalChinese = countChineseChars(value);
        int repairedChinese = countChineseChars(repaired);
        return repairedChinese > originalChinese ? repaired : value;
    }

    private int countChineseChars(String text) {
        int count = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch >= 0x4E00 && ch <= 0x9FFF) {
                count++;
            }
        }
        return count;
    }

    private void validateConfig() {
        if (!StringUtils.hasText(properties.getBotId())) {
            throw new IllegalStateException("COZE_BOT_ID is required");
        }
        if (!StringUtils.hasText(properties.getPat())) {
            throw new IllegalStateException("COZE_PAT is required");
        }
        if (!StringUtils.hasText(properties.getBaseUrl())) {
            throw new IllegalStateException("COZE_API_BASE_URL is required");
        }
        if (!StringUtils.hasText(properties.getChatPath())) {
            throw new IllegalStateException("COZE_API_CHAT_PATH is required");
        }
    }

    public record AgentChunk(AgentChunkType type, String content) {

        static AgentChunk token(String token) {
            return new AgentChunk(AgentChunkType.TOKEN, token);
        }

        static AgentChunk thinking(String content) {
            return new AgentChunk(AgentChunkType.THINKING, content);
        }

        static AgentChunk done() {
            return new AgentChunk(AgentChunkType.DONE, "[DONE]");
        }

        static AgentChunk error(String message) {
            return new AgentChunk(AgentChunkType.ERROR, message);
        }
    }

    public enum AgentChunkType {
        TOKEN,
        THINKING,
        DONE,
        ERROR
    }
}
