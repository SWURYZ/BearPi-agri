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
@Table(name = "iot_device_telemetry")
public class DeviceTelemetry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String deviceId;

    @Column(length = 64)
    private String serviceId;

    private Double temperature;
    private Double humidity;
    private Double luminance;

    @Column(length = 32)
    private String ledStatus;

    @Column(length = 32)
    private String motorStatus;

    @Column(nullable = false)
    private LocalDateTime reportTime;

    @Column(columnDefinition = "TEXT")
    private String rawPayload;

    @PrePersist
    void prePersist() {
        if (reportTime == null) {
            reportTime = LocalDateTime.now();
        }
    }
}
