package com.smartagri.facerecognition.controller;

import com.smartagri.facerecognition.dto.AuthResponse;
import com.smartagri.facerecognition.dto.UserResponse;
import com.smartagri.facerecognition.entity.AppUser;
import com.smartagri.facerecognition.entity.LoginLog;
import com.smartagri.facerecognition.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "用户认证", description = "用户注册、登录、人脸绑定")
public class AuthController {

    private final UserService userService;

    @Operation(summary = "是否首次使用（无用户）")
    @GetMapping("/first-user")
    public ResponseEntity<Map<String, Boolean>> isFirstUser() {
        return ResponseEntity.ok(Map.of("firstUser", userService.isFirstUser()));
    }

    @Operation(summary = "注册（首次注册为管理员）")
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody Map<String, String> body, HttpServletRequest request) {
        return ResponseEntity.ok(userService.register(
                body.get("username"), body.get("password"), body.get("displayName"), getClientIp(request)));
    }

    @Operation(summary = "密码登录")
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        return ResponseEntity.ok(userService.login(body.get("username"), body.get("password"), getClientIp(request)));
    }

    @Operation(summary = "人脸登录")
    @PostMapping(value = "/face-login", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AuthResponse> faceLogin(@RequestParam("image") MultipartFile image, HttpServletRequest request) {
        return ResponseEntity.ok(userService.loginByFace(image, getClientIp(request)));
    }

    @Operation(summary = "获取当前用户")
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(userService.getCurrentUser(extractToken(auth)));
    }

    @Operation(summary = "登出")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String auth) {
        userService.logout(extractToken(auth));
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "获取所有用户（登录用户可查看）")
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers(@RequestHeader("Authorization") String auth) {
        requireLogin(auth);
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @Operation(summary = "任意已登录农户为他人注册用户（含可选人脸）")
    @PostMapping(value = "/users", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserResponse> createUser(
            @RequestHeader("Authorization") String auth,
            @RequestParam("username") String username,
            @RequestParam("password") String password,
            @RequestParam("displayName") String displayName,
            @RequestParam(value = "image", required = false) MultipartFile image) {
        AppUser operator = requireLogin(auth);
        return ResponseEntity.ok(
                userService.registerUserWithFace(username, password, displayName, image, operator.getId()));
    }

    @Operation(summary = "修改用户角色（管理员）")
    @PutMapping("/users/{id}/role")
    public ResponseEntity<UserResponse> updateUserRole(
            @RequestHeader("Authorization") String auth,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        AppUser admin = requireAdmin(auth);
        return ResponseEntity.ok(userService.updateUserRole(id, body.get("role"), admin.getId()));
    }

    @Operation(summary = "删除用户（管理员）")
    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(
            @RequestHeader("Authorization") String auth,
            @PathVariable("id") Long id) {
        AppUser admin = requireAdmin(auth);
        userService.deleteUser(id, admin.getId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "登录日志（仅管理员可查看）")
    @GetMapping("/logs")
    public ResponseEntity<List<LoginLog>> getLogs(@RequestHeader("Authorization") String auth) {
        requireAdmin(auth);
        return ResponseEntity.ok(userService.getLoginLogs());
    }

    @Operation(summary = "为用户注册/更新人脸")
    @PutMapping(value = "/users/{id}/face", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserResponse> updateFace(
            @RequestHeader("Authorization") String auth,
            @PathVariable("id") Long id,
            @RequestParam("image") MultipartFile image) {
        requireLogin(auth);
        return ResponseEntity.ok(userService.updateUserFace(id, image));
    }

    @Operation(summary = "系统初始化（清除所有用户，仅首次部署/调试使用）")
    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> reset() {
        userService.resetAll();
        return ResponseEntity.ok(Map.of("success", true, "message", "系统已初始化，请注册管理员账户"));
    }

    /* ========== helpers ========== */

    private String extractToken(String auth) {
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7);
        }
        return auth;
    }

    private AppUser requireLogin(String auth) {
        AppUser user = userService.getUserByToken(extractToken(auth));
        if (user == null) throw new IllegalArgumentException("未登录或会话已过期");
        return user;
    }

    private AppUser requireAdmin(String auth) {
        AppUser user = requireLogin(auth);
        if (!"admin".equals(user.getRole())) {
            throw new IllegalArgumentException("仅管理员可执行此操作");
        }
        return user;
    }

    /** 获取真实客户端 IP（兼容反向代理） */
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank() && !"unknown".equalsIgnoreCase(ip)) {
            return ip.split(",")[0].trim();
        }
        ip = request.getHeader("X-Real-IP");
        if (ip != null && !ip.isBlank() && !"unknown".equalsIgnoreCase(ip)) {
            return ip.trim();
        }
        return request.getRemoteAddr();
    }
}
