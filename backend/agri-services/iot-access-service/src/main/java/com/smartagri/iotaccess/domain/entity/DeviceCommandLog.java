package com.smartagri.iotaccess.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "iot_device_command_log")
public class DeviceCommandLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String deviceId;

    @Column(length = 64)
    private String requestId;

    @Column(length = 64)
    private String cloudCommandId;

    @Column(nullable = false, length = 64)
    private String commandType;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String commandPayload;

    @Column(length = 255)
    private String errorMessage;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }
}
