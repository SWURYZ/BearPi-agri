package com.smartagri.devicecontrol.domain.entity;

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

@Getter
@Setter
@Entity
@Table(name = "device_status")
public class DeviceStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64, unique = true)
    private String deviceId;

    @Column(length = 32)
    private String ledStatus;

    @Column(length = 32)
    private String motorStatus;

    @Column(nullable = false)
    private LocalDateTime lastUpdated;

    @PrePersist
    void prePersist() {
        if (lastUpdated == null) {
            lastUpdated = LocalDateTime.now();
        }
    }

    @PreUpdate
    void preUpdate() {
        lastUpdated = LocalDateTime.now();
    }
}
