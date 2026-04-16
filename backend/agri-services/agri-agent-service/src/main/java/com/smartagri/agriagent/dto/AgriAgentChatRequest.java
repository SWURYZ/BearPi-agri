package com.smartagri.agriagent.dto;

import jakarta.validation.constraints.NotBlank;

public record AgriAgentChatRequest(
        @NotBlank(message = "question cannot be blank") String question,
        String userId,
        String conversationId
) {
}
