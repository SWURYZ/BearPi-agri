package com.smartagri.thresholdalert.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "threshold_alert_record")
public class ThresholdAlertRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String deviceId;

    @Column(nullable = false, length = 32)
    private String metricType;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal currentValue;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal minThreshold;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal maxThreshold;

    @Column(nullable = false, length = 255)
    private String alertMessage;

    @Column(nullable = false)
    private LocalDateTime alertedAt;

    @PrePersist
    void prePersist() {
        if (alertedAt == null) {
            alertedAt = LocalDateTime.now();
        }
    }
}
