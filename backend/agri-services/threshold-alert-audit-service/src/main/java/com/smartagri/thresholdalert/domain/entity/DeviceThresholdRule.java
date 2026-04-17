package com.smartagri.thresholdalert.domain.entity;

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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "threshold_rule")
public class DeviceThresholdRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String deviceId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal temperatureMin;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal temperatureMax;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal humidityMin;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal humidityMax;

    @Column(precision = 10, scale = 2)
    private BigDecimal lightMin;

    @Column(precision = 10, scale = 2)
    private BigDecimal lightMax;

    @Column(precision = 10, scale = 2)
    private BigDecimal co2Min;

    @Column(precision = 10, scale = 2)
    private BigDecimal co2Max;

    @Column(precision = 10, scale = 2)
    private BigDecimal soilHumidityMin;

    @Column(precision = 10, scale = 2)
    private BigDecimal soilHumidityMax;

    @Column(precision = 10, scale = 2)
    private BigDecimal soilTemperatureMin;

    @Column(precision = 10, scale = 2)
    private BigDecimal soilTemperatureMax;

    @Column(nullable = false)
    private boolean enabled = true;

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

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
