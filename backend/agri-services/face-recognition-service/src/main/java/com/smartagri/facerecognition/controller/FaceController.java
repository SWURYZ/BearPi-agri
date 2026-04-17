package com.smartagri.facerecognition.controller;

import com.smartagri.facerecognition.dto.FaceRecognizeResponse;
import com.smartagri.facerecognition.dto.FaceRecordInfo;
import com.smartagri.facerecognition.dto.FaceRegisterResponse;
import com.smartagri.facerecognition.service.FaceRecognitionService;
import com.smartagri.facerecognition.service.SmartAIModelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/face")
@RequiredArgsConstructor
@Tag(name = "人脸识别", description = "人脸注册、识别、验证接口")
public class FaceController {

    private final FaceRecognitionService faceRecognitionService;
    private final SmartAIModelService smartAIModelService;
    private final com.smartagri.facerecognition.config.FaceRecognitionProperties faceProperties;

    @Operation(summary = "模型状态", description = "检查 SmartJavaAI 人脸识别模型是否已加载就绪")
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "modelReady", smartAIModelService.isReady(),
                "livenessReady", smartAIModelService.isLivenessReady(),
                "message", smartAIModelService.isReady() ? "模型已就绪" : "模型未加载，请检查配置"
        ));
    }

    @Operation(summary = "注册人脸", description = "上传人脸照片并注册到系统中")
    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FaceRegisterResponse> register(
            @RequestParam("image") MultipartFile image,
            @RequestParam("personName") String personName,
            @RequestParam(value = "personId", required = false) String personId) {
        return ResponseEntity.ok(faceRecognitionService.register(image, personName, personId));
    }

    @Operation(summary = "人脸识别 (1:N)", description = "上传人脸照片，在所有已注册人脸中查找最相似的匹配")
    @PostMapping(value = "/recognize", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FaceRecognizeResponse> recognize(
            @RequestParam("image") MultipartFile image) {
        return ResponseEntity.ok(faceRecognitionService.recognize(image));
    }

    @Operation(summary = "人脸验证 (1:1)", description = "上传人脸照片，与指定人员进行比对验证")
    @PostMapping(value = "/verify", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FaceRecognizeResponse> verify(
            @RequestParam("image") MultipartFile image,
            @RequestParam("personId") String personId) {
        return ResponseEntity.ok(faceRecognitionService.verify(image, personId));
    }

    @Operation(summary = "查询所有已注册人脸")
    @GetMapping("/records")
    public ResponseEntity<List<FaceRecordInfo>> listAll() {
        return ResponseEntity.ok(faceRecognitionService.listAll());
    }

    @Operation(summary = "删除已注册人脸")
    @DeleteMapping("/records/{personId}")
    public ResponseEntity<Void> delete(@PathVariable("personId") String personId) {
        faceRecognitionService.delete(personId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "活体检测", description = "上传照片进行活体检测，返回活体得分")
    @PostMapping(value = "/liveness", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> liveness(@RequestParam("image") MultipartFile image) {
        var result = faceRecognitionService.checkLiveness(image);
        if (result == null) {
            return ResponseEntity.ok(Map.of("score", -1, "passed", false, "available", false, "message", "活体检测不可用"));
        }
        boolean passed = result.getStatus() == cn.smartjavaai.common.enums.face.LivenessStatus.LIVE;
        return ResponseEntity.ok(Map.of(
                "score", result.getScore(),
                "passed", passed,
                "available", true,
                "message", passed ? "活体检测通过" : "活体检测未通过：" + result.getStatus().getDescription()
        ));
    }
}
