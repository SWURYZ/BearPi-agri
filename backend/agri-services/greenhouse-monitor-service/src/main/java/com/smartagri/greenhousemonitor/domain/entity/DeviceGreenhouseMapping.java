package com.smartagri.greenhousemonitor.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 设备与大棚的绑定映射表
 * 记录每台设备（传感器/执行器）所属的大棚，支持扫码绑定与解绑
 */
@Getter
@Setter
@Entity
@Table(name = "device_greenhouse_mapping")
public class DeviceGreenhouseMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 设备 ID（对应 IoTDA 中的 device_id） */
    @Column(nullable = false, length = 64, unique = true)
    private String deviceId;

    /** 设备名称（可选，由扫码或手动填写） */
    @Column(length = 128)
    private String deviceName;

    /** 设备类型，如 SENSOR_TEMP / SENSOR_HUMIDITY / ACTUATOR_LIGHT 等 */
    @Column(length = 64)
    private String deviceType;

    /** 所属大棚编码 */
    @Column(nullable = false, length = 64)
    private String greenhouseCode;

    /** 绑定状态：BOUND / UNBOUND */
    @Column(nullable = false, length = 16)
    private String status = "BOUND";

    /** 绑定时间 */
    @Column(nullable = false)
    private LocalDateTime boundAt;

    /** 解绑时间（解绑后记录） */
    private LocalDateTime unboundAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (boundAt == null) {
            boundAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
