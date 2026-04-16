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
import java.util.ArrayList;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CozeAgentService {

    private static final ParameterizedTypeReference<ServerSentEvent<String>> SSE_STRING_TYPE = new ParameterizedTypeReference<>() {
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
        payload.put("user_id",
                StringUtils.hasText(request.userId()) ? request.userId() : "agri-web-" + UUID.randomUUID());
        payload.put("stream", true);
        payload.put("auto_save_history", true);

        if (StringUtils.hasText(request.conversationId())) {
            payload.put("conversation_id", request.conversationId());
        }

        payload.put("additional_messages", List.of(
                Map.of(
                        "role", "user",
                        "content", request.question(),
                        "content_type", "text")));

        return payload;
    }

    private Flux<AgentChunk> parseSseEvent(ServerSentEvent<String> event) {
        String sseEventName = event.event();
        String lowerEventName = sseEventName == null ? "" : sseEventName.toLowerCase();
        String data = event.data();

        if (StringUtils.hasText(data)) {
            String conversationId = parseConversationId(data);
            if (StringUtils.hasText(conversationId)) {
                if (lowerEventName.contains("chat.completed")) {
                    return Flux.just(AgentChunk.context(conversationId), AgentChunk.done());
                }
                if (lowerEventName.contains("message.completed")) {
                    return Flux.just(AgentChunk.context(conversationId));
                }
            }
        }

        // Skip conversation.message.completed to avoid duplicating streamed tokens
        if (lowerEventName.contains("message.completed")) {
            return Flux.empty();
        }
        // conversation.chat.completed signals end of stream
        if (lowerEventName.contains("chat.completed")) {
            return Flux.just(AgentChunk.done());
        }

        if (!StringUtils.hasText(data)) {
            return Flux.empty();
        }

        String trimmed = data.trim();
        if ("[DONE]".equalsIgnoreCase(trimmed)) {
            return Flux.just(AgentChunk.done());
        }

        try {
            JsonNode root = objectMapper.readTree(trimmed);
            List<AgentChunk> chunks = parseCozeNodes(root);
            if (!chunks.isEmpty()) {
                return Flux.fromIterable(chunks);
            }
        } catch (Exception ignored) {
            if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
                String eventName = sseEventName == null ? "" : sseEventName.toLowerCase();
                if (eventName.contains("reasoning") || eventName.contains("thinking")) {
                    return Flux.just(AgentChunk.thinking(fixPossibleMojibake(trimmed)));
                }
                return Flux.just(AgentChunk.token(fixPossibleMojibake(trimmed)));
            }
        }

        return Flux.empty();
    }

    private List<AgentChunk> parseCozeNodes(JsonNode node) {
        if (node == null || node.isNull()) {
            return List.of();
        }

        List<AgentChunk> chunks = new ArrayList<>();

        String conversationId = firstNonBlank(
                textNode(node, "/conversation_id"),
                textNode(node, "/conversation/id"),
                deepText(node, "conversation_id"));
        if (StringUtils.hasText(conversationId)) {
            addChunk(chunks, AgentChunk.context(conversationId));
        }

        // --- Coze v3 conversation.message.delta format ---
        // Some providers may include reasoning and answer in the same delta object.
        String nodeType = textNode(node, "/type");
        String lowerNodeType = StringUtils.hasText(nodeType) ? nodeType.toLowerCase() : "";

        if (lowerNodeType.contains("completed") || lowerNodeType.contains("finish")) {
            addChunk(chunks, AgentChunk.done());
            return chunks;
        }

        boolean isReasoningType = "reasoning".equals(lowerNodeType)
                || "thinking".equals(lowerNodeType)
                || "verbose".equals(lowerNodeType);

        String reasoning = firstNonBlank(
                textNode(node, "/reasoning_content"),
                textNode(node, "/delta/reasoning_content"),
                textNode(node, "/delta/reasoning"),
                textNode(node, "/thinking"),
                deepText(node, "reasoning_content", "reasoning", "thinking_content", "thinking"));
        if (isReasoningType) {
            reasoning = firstNonBlank(reasoning, textNode(node, "/content"), textNode(node, "/delta"));
        }
        if (StringUtils.hasText(reasoning)) {
            addChunk(chunks, AgentChunk.thinking(fixPossibleMojibake(reasoning)));
        }

        if (!isReasoningType && "answer".equals(lowerNodeType)) {
            String answer = firstNonBlank(
                    textNode(node, "/content"),
                    textNode(node, "/delta/content"),
                    textNode(node, "/delta/text"),
                    textNode(node, "/delta"),
                    textNode(node, "/answer"),
                    deepText(node, "answer", "content"));
            if (StringUtils.hasText(answer)) {
                addChunk(chunks, AgentChunk.token(fixPossibleMojibake(answer)));
            }
        }

        // If type is absent or ambiguous, still try answer channel for compatibility.
        if (!StringUtils.hasText(lowerNodeType)) {
            String answer = firstNonBlank(
                    textNode(node, "/content"),
                    textNode(node, "/delta/content"),
                    textNode(node, "/delta/text"),
                    textNode(node, "/delta"),
                    textNode(node, "/answer"),
                    deepText(node, "answer", "content"));
            if (StringUtils.hasText(answer)) {
                addChunk(chunks, AgentChunk.token(fixPossibleMojibake(answer)));
            }
        }

        // --- Legacy / fallback msg_type format ---
        String msgType = textNode(node, "/msg_type");
        if (StringUtils.hasText(msgType)) {
            if ("generate_answer_finish".equalsIgnoreCase(msgType)) {
                addChunk(chunks, AgentChunk.done());
                return chunks;
            }
            if ("answer".equalsIgnoreCase(msgType)) {
                String answer = firstNonBlank(textNode(node, "/content"), textNode(node, "/answer"),
                        textNode(node, "/delta"));
                if (StringUtils.hasText(answer)) {
                    addChunk(chunks, AgentChunk.token(fixPossibleMojibake(answer)));
                }
            }
        }

        // --- event field fallback ---
        String eventType = textNode(node, "/event");
        if (StringUtils.hasText(eventType)) {
            String lowerType = eventType.toLowerCase();
            if (lowerType.contains("completed") || lowerType.contains("finish")) {
                addChunk(chunks, AgentChunk.done());
                return chunks;
            }
            if (lowerType.contains("reasoning") || lowerType.contains("thinking")) {
                String reasoningByEvent = firstNonBlank(textNode(node, "/content"),
                        textNode(node, "/reasoning_content"),
                        textNode(node, "/delta"), deepText(node, "reasoning_content", "reasoning", "thinking"));
                if (StringUtils.hasText(reasoningByEvent)) {
                    addChunk(chunks, AgentChunk.thinking(fixPossibleMojibake(reasoningByEvent)));
                }
            }
            if (lowerType.contains("delta") || lowerType.contains("answer")) {
                String answer = firstNonBlank(textNode(node, "/content"), textNode(node, "/delta"),
                        textNode(node, "/answer"), deepText(node, "answer", "content"));
                if (StringUtils.hasText(answer)) {
                    addChunk(chunks, AgentChunk.token(fixPossibleMojibake(answer)));
                }
            }
        }

        JsonNode dataNode = node.get("data");
        if (dataNode != null && !dataNode.isNull()) {
            if (dataNode.isObject() || dataNode.isArray()) {
                for (AgentChunk nested : parseCozeNodes(dataNode)) {
                    addChunk(chunks, nested);
                }
            }
            if (dataNode.isTextual()) {
                String rawData = dataNode.asText();
                String rawDataTrimmed = rawData == null ? "" : rawData.trim();
                if (StringUtils.hasText(rawDataTrimmed)
                        && (rawDataTrimmed.startsWith("{") || rawDataTrimmed.startsWith("["))) {
                    try {
                        for (AgentChunk nested : parseCozeNodes(objectMapper.readTree(rawDataTrimmed))) {
                            addChunk(chunks, nested);
                        }
                    } catch (Exception ignored) {
                        // ignore malformed nested json
                    }
                }
            }
        }

        if (node.isArray()) {
            for (JsonNode item : node) {
                for (AgentChunk nested : parseCozeNodes(item)) {
                    addChunk(chunks, nested);
                }
            }
        }

        return chunks;
    }

    private String parseConversationId(String rawData) {
        if (!StringUtils.hasText(rawData)) {
            return null;
        }
        String trimmed = rawData.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(trimmed);
            return firstNonBlank(
                    textNode(root, "/conversation_id"),
                    textNode(root, "/conversation/id"),
                    deepText(root, "conversation_id"));
        } catch (Exception ignored) {
            return null;
        }
    }

    private void addChunk(List<AgentChunk> chunks, AgentChunk chunk) {
        if (chunk == null) {
            return;
        }
        if (chunks.isEmpty()) {
            chunks.add(chunk);
            return;
        }
        AgentChunk last = chunks.get(chunks.size() - 1);
        if (last.type() == chunk.type() && String.valueOf(last.content()).equals(String.valueOf(chunk.content()))) {
            return;
        }
        chunks.add(chunk);
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

    private String deepText(JsonNode node, String... fieldNames) {
        if (node == null || node.isNull() || fieldNames == null) {
            return null;
        }
        for (String field : fieldNames) {
            if (!StringUtils.hasText(field)) {
                continue;
            }
            JsonNode found = node.findValue(field);
            if (found == null || found.isNull()) {
                continue;
            }
            if (found.isTextual()) {
                String value = found.asText();
                if (StringUtils.hasText(value)) {
                    return value;
                }
                continue;
            }
            if (found.isObject()) {
                JsonNode text = found.get("text");
                if (text != null && text.isTextual() && StringUtils.hasText(text.asText())) {
                    return text.asText();
                }
            }
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

        static AgentChunk context(String conversationId) {
            return new AgentChunk(AgentChunkType.CONTEXT, conversationId);
        }

        static AgentChunk error(String message) {
            return new AgentChunk(AgentChunkType.ERROR, message);
        }
    }

    public enum AgentChunkType {
        TOKEN,
        THINKING,
        CONTEXT,
        DONE,
        ERROR
    }
}
