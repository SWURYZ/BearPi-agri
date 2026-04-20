package com.smartagri.facerecognition.service;

import com.smartagri.facerecognition.dto.AuthResponse;
import com.smartagri.facerecognition.dto.UserResponse;
import com.smartagri.facerecognition.entity.AppUser;
import com.smartagri.facerecognition.entity.LoginLog;
import com.smartagri.facerecognition.repository.AppUserRepository;
import com.smartagri.facerecognition.repository.LoginLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final AppUserRepository userRepository;
    private final LoginLogRepository loginLogRepository;
    private final TokenStore tokenStore;
    private final SmartAIModelService smartAIModelService;
    private final FaceRecognitionService faceRecognitionService;

    /* ========== 公开 API ========== */

    public boolean isFirstUser() {
        return userRepository.count() == 0;
    }

    /** 注册（第一个用户自动为管理员） */
    @Transactional
    public AuthResponse register(String username, String password, String displayName, String clientIp) {
        validateRegistration(username, password, displayName);

        boolean isFirst = userRepository.count() == 0;
        AppUser user = AppUser.builder()
                .username(username)
                .passwordHash(hashPassword(password))
                .displayName(displayName.trim())
                .role(isFirst ? "admin" : "user")
                .faceRegistered(false)
                .build();
        userRepository.save(user);

        String token = tokenStore.createToken(user.getId());
        recordLoginLog(user, "register", clientIp);
        log.info("用户注册成功: username={}, role={}", username, user.getRole());
        return AuthResponse.builder().token(token).user(toResponse(user)).build();
    }

    /** 密码登录 */
    public AuthResponse login(String username, String password, String clientIp) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("用户名或密码错误"));

        if (!user.getPasswordHash().equals(hashPassword(password))) {
            throw new IllegalArgumentException("用户名或密码错误");
        }

        String token = tokenStore.createToken(user.getId());
        recordLoginLog(user, "password", clientIp);
        log.info("用户登录成功: username={}, ip={}", username, clientIp);
        return AuthResponse.builder().token(token).user(toResponse(user)).build();
    }

    /** 人脸登录：后端完成识别 + 匹配用户 */
    public AuthResponse loginByFace(MultipartFile imageFile, String clientIp) {
        if (!smartAIModelService.isReady()) {
            throw new IllegalStateException("人脸识别模型未就绪");
        }

        var recognizeResult = faceRecognitionService.recognize(imageFile);
        if (!recognizeResult.isMatched()) {
            throw new IllegalArgumentException("未识别到匹配的人脸");
        }

        AppUser user = userRepository.findByFacePersonId(recognizeResult.getPersonId())
                .orElseThrow(() -> new IllegalArgumentException("人脸已识别但未关联到系统用户"));

        String token = tokenStore.createToken(user.getId());
        recordLoginLog(user, "face", clientIp);
        log.info("人脸登录成功: username={}, ip={}", user.getUsername(), clientIp);
        return AuthResponse.builder().token(token).user(toResponse(user)).build();
    }

    /** 任意已登录农户为他人注册（注明负责人） */
    @Transactional
    public UserResponse registerUserWithFace(String username, String password, String displayName,
                                             MultipartFile imageFile, Long operatorUserId) {
        AppUser operator = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new IllegalArgumentException("操作用户不存在"));

        validateRegistration(username, password, displayName);

        String personId = null;
        if (imageFile != null && !imageFile.isEmpty()) {
            var faceResult = faceRecognitionService.register(imageFile, displayName.trim(), null);
            personId = faceResult.getPersonId();
        }

        AppUser user = AppUser.builder()
                .username(username)
                .passwordHash(hashPassword(password))
                .displayName(displayName.trim())
                .role("user")
                .registeredBy(operator.getUsername())
                .faceRegistered(personId != null)
                .facePersonId(personId)
                .build();
        userRepository.save(user);

        log.info("用户注册: username={}, registeredBy={}, faceRegistered={}",
                username, operator.getUsername(), personId != null);
        return toResponse(user);
    }

    /** 为用户注册/更新人脸 */
    @Transactional
    public UserResponse updateUserFace(Long userId, MultipartFile imageFile) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        // 删除旧人脸记录
        if (user.getFacePersonId() != null) {
            try {
                faceRecognitionService.delete(user.getFacePersonId());
            } catch (Exception e) {
                log.warn("删除旧人脸记录失败: {}", e.getMessage());
            }
        }

        var faceResult = faceRecognitionService.register(imageFile, user.getDisplayName(), null);
        user.setFaceRegistered(true);
        user.setFacePersonId(faceResult.getPersonId());
        userRepository.save(user);

        log.info("用户人脸更新: userId={}, personId={}", userId, faceResult.getPersonId());
        return toResponse(user);
    }

    /** 根据 Token 获取用户实体（内部使用） */
    public AppUser getUserByToken(String token) {
        Long userId = tokenStore.getUserId(token);
        if (userId == null) return null;
        return userRepository.findById(userId).orElse(null);
    }

    /** 获取当前用户信息 */
    public UserResponse getCurrentUser(String token) {
        AppUser user = getUserByToken(token);
        if (user == null) throw new IllegalArgumentException("未登录或会话已过期");
        return toResponse(user);
    }

    /** 获取所有用户 */
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /** 获取登录日志（所有用户，按时间倒序） */
    public List<LoginLog> getLoginLogs() {
        return loginLogRepository.findAllByOrderByLoginTimeDesc();
    }

    /** 管理员删除用户 */
    @Transactional
    public void deleteUser(Long userId, Long adminUserId) {
        if (userId.equals(adminUserId)) {
            throw new IllegalArgumentException("不能删除自己的账户");
        }
        AppUser admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new IllegalArgumentException("管理员不存在"));
        if (!"admin".equals(admin.getRole())) {
            throw new IllegalArgumentException("仅管理员可删除用户");
        }

        AppUser target = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (target.getFacePersonId() != null) {
            try {
                faceRecognitionService.delete(target.getFacePersonId());
            } catch (Exception e) {
                log.warn("删除人脸记录失败: {}", e.getMessage());
            }
        }

        userRepository.delete(target);
        log.info("用户已删除: userId={}, username={}", userId, target.getUsername());
    }

    /** 管理员修改用户角色 */
    @Transactional
    public UserResponse updateUserRole(Long userId, String newRole, Long adminUserId) {
        if (!"admin".equals(newRole) && !"user".equals(newRole)) {
            throw new IllegalArgumentException("无效的角色值");
        }
        AppUser admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new IllegalArgumentException("管理员不存在"));
        if (!"admin".equals(admin.getRole())) {
            throw new IllegalArgumentException("仅管理员可修改用户角色");
        }
        if (userId.equals(adminUserId)) {
            throw new IllegalArgumentException("不能修改自己的角色");
        }
        AppUser target = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        target.setRole(newRole);
        userRepository.save(target);
        log.info("用户角色已修改: userId={}, newRole={}, byAdmin={}", userId, newRole, admin.getUsername());
        return toResponse(target);
    }

    /** 登出 */
    public void logout(String token) {
        tokenStore.removeToken(token);
    }

    /** 系统初始化：清除所有用户（仅在开发调试时使用） */
    @Transactional
    public void resetAll() {
        userRepository.findAll().forEach(u -> {
            if (u.getFacePersonId() != null) {
                try { faceRecognitionService.delete(u.getFacePersonId()); } catch (Exception e) { log.warn("清理人脸失败: {}", e.getMessage()); }
            }
        });
        userRepository.deleteAll();
        tokenStore.clearAll();
        log.warn("系统已初始化：所有用户和人脸记录已清除");
    }

    /* ========== 工具方法 ========== */

    private void validateRegistration(String username, String password, String displayName) {
        if (username == null || username.length() < 2)
            throw new IllegalArgumentException("用户名至少2个字符");
        if (password == null || password.length() < 6)
            throw new IllegalArgumentException("密码至少6个字符");
        if (displayName == null || displayName.isBlank())
            throw new IllegalArgumentException("请输入显示名称");
        if (userRepository.existsByUsername(username))
            throw new IllegalArgumentException("用户名已存在");
    }

    /** SHA-256 + 固定盐（与前端原算法一致） */
    static String hashPassword(String password) {
        try {
            String salted = password + "_smartagri_salt_2026";
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(salted.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("密码哈希失败", e);
        }
    }

    private UserResponse toResponse(AppUser user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .registeredBy(user.getRegisteredBy())
                .faceRegistered(user.isFaceRegistered())
                .facePersonId(user.getFacePersonId())
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null)
                .build();
    }

    private void recordLoginLog(AppUser user, String loginType, String clientIp) {
        try {
            loginLogRepository.save(LoginLog.builder()
                    .userId(user.getId())
                    .username(user.getUsername())
                    .displayName(user.getDisplayName())
                    .loginType(loginType)
                    .clientIp(clientIp)
                    .build());
        } catch (Exception e) {
            log.error("登录日志记录失败: username={}, type={}, ip={}, error={}",
                    user.getUsername(), loginType, clientIp, e.getMessage(), e);
        }
    }
}
