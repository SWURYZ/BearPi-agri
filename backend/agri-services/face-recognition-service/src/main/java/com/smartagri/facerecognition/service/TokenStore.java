package com.smartagri.facerecognition.service;

import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 简易内存 Token 存储。服务重启后 Token 失效（用户需重新登录）。
 */
@Component
public class TokenStore {

    private final ConcurrentHashMap<String, Long> tokens = new ConcurrentHashMap<>();

    public String createToken(Long userId) {
        String token = UUID.randomUUID().toString();
        tokens.put(token, userId);
        return token;
    }

    public Long getUserId(String token) {
        if (token == null) return null;
        return tokens.get(token);
    }

    public void removeToken(String token) {
        if (token != null) tokens.remove(token);
    }

    public void clearAll() {
        tokens.clear();
    }
}
