package com.smartagri.greenhousemonitor.domain.entity;

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
 * 大棚传感器最新数据汇总
 * 以 (greenhouseCode, metric) 联合主键存储，由 IoT 接入层推送更新
 */
@Getter
@Setter
@Entity
@Table(name = "greenhouse_sensor_snapshot")
public class GreenhouseSensorSnapshot {

    @Id
    @Column(length = 160)
    private String pk; // greenhouseCode + "#" + metric

    @Column(nullable = false, length = 64)
    private String greenhouseCode;

    /** 传感器指标，如 temperature / humidity / light_intensity / co2 */
    @Column(nullable = false, length = 64)
    private String metric;

    @Column(nullable = false)
    private Double value;

    /** 数据单位，如 ℃ / % / lux / ppm */
    @Column(length = 16)
    private String unit;

    /** 采集数据的设备 ID */
    @Column(length = 64)
    private String sourceDeviceId;

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
