package com.smartagri.agriagent.controller;

import com.smartagri.agriagent.dto.AgriAgentChatRequest;
import com.smartagri.agriagent.dto.AgriAgentChatResponse;
import com.smartagri.agriagent.service.CozeAgentService;
import com.smartagri.common.model.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.IOException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/agri-agent")
public class AgriAgentController {

    private final CozeAgentService cozeAgentService;

    @PostMapping("/chat")
    public ApiResponse<AgriAgentChatResponse> chat(@Valid @RequestBody AgriAgentChatRequest request) {
        String answer = cozeAgentService.chat(request).block();
        return ApiResponse.success(new AgriAgentChatResponse(answer));
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@Valid @RequestBody AgriAgentChatRequest request) {
        SseEmitter emitter = new SseEmitter(0L);

        Disposable disposable = cozeAgentService.streamChat(request)
                .subscribe(chunk -> {
                    try {
                        switch (chunk.type()) {
                            case TOKEN -> emitter.send(SseEmitter.event().name("token").data(chunk.content()));
                            case THINKING -> emitter.send(SseEmitter.event().name("thinking").data(chunk.content()));
                            case CONTEXT -> emitter.send(SseEmitter.event().name("context").data(chunk.content()));
                            case DONE -> {
                                emitter.send(SseEmitter.event().name("done").data(chunk.content()));
                                emitter.complete();
                            }
                            case ERROR -> {
                                emitter.send(SseEmitter.event().name("error").data(chunk.content()));
                                emitter.complete();
                            }
                        }
                    } catch (IOException sendException) {
                        emitter.completeWithError(sendException);
                    }
                }, emitter::completeWithError, emitter::complete);

        emitter.onCompletion(disposable::dispose);
        emitter.onTimeout(() -> {
            disposable.dispose();
            emitter.complete();
        });

        return emitter;
    }
}
