banpackage com.smartagri.agriagent.controller;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.IOException;
import java.util.Map;

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
        return streamInternal(request);
    }

    /**
     * 上传图片 + 文本提问（多模态）。<br>
     * 表单字段：{@code image}（图片文件）、{@code question}（文本，默认"描述这张图片"）、
     * {@code userId}、{@code conversationId}（均可选）。
     */
    @PostMapping(
            value = "/chat/stream/with-image",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamWithImage(
            @RequestPart("image") MultipartFile image,
            @RequestParam(value = "question", required = false, defaultValue = "请分析这张图片的内容") String question,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "conversationId", required = false) String conversationId) {
        String fileId = cozeAgentService.uploadFile(image);
        AgriAgentChatRequest request = new AgriAgentChatRequest(question, userId, conversationId, fileId);
        return streamInternal(request);
    }

    /**
     * 仅上传图片到 Coze，返回 file_id（方便前端分两步调用）。
     */
    @PostMapping(value = "/files/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Map<String, String>> uploadFile(@RequestPart("file") MultipartFile file) {
        String fileId = cozeAgentService.uploadFile(file);
        return ApiResponse.success(Map.of("fileId", fileId));
    }

    private SseEmitter streamInternal(AgriAgentChatRequest request) {
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
