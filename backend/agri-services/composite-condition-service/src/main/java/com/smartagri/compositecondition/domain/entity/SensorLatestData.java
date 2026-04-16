package com.smartagri.compositecondition.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 传感器最新数据缓存 – 由 IoT 接入层或外部推送写入，
 * 供规则引擎实时匹配使用。
 * 以 (deviceId, metric) 为联合主键。
 */
@Getter
@Setter
@Entity
@Table(name = "sensor_latest_data")
public class SensorLatestData {

    @Id
    @Column(length = 128)
    private String pk; // deviceId + "#" + metric

    @Column(nullable = false, length = 64)
    private String deviceId;

    @Column(nullable = false, length = 64)
    private String metric;

    @Column(name = "metric_value", nullable = false)
    private Double value;

    @Column(nullable = false)
    private LocalDateTime reportedAt;

    @PrePersist
    void prePersist() {
        if (reportedAt == null) {
            reportedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    void preUpdate() {
        reportedAt = LocalDateTime.now();
    }
}
