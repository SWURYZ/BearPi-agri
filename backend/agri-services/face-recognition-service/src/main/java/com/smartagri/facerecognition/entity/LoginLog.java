package com.smartagri.facerecognition.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "login_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(length = 50)
    private String displayName;

    @Column(nullable = false, length = 10)
    private String loginType; // "password" | "face"

    @Column(length = 50)
    private String clientIp; // 客户端 IP，用于区分本机/他机登录

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime loginTime;
}
