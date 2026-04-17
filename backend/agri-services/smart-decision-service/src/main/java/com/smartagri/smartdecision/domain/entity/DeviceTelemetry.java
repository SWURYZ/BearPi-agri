package com.smartagri.smartdecision.domain.entity;

import jakarta.persistence.*;
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
}
