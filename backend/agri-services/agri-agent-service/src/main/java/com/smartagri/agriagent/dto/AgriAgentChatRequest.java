package com.smartagri.agriagent.dto;

import jakarta.validation.constraints.NotBlank;

public record AgriAgentChatRequest(
        @NotBlank(message = "question cannot be blank") String question,
        String userId,
        String conversationId,
        /** 可选：Coze 文件上传后返回的 file_id（图片理解时携带） */
        String fileId
) {
}
