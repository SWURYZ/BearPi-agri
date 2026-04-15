package com.smartagri.lightschedule.domain.entity;

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
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "light_schedule_rule")
public class ScheduleRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String deviceId;

    @Column(nullable = false, length = 64)
    private String ruleName;

    @Column(nullable = false)
    private LocalTime turnOnTime;

    @Column(nullable = false)
    private LocalTime turnOffTime;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(length = 32)
    private String repeatMode;

    @Column(nullable = false, length = 32)
    private String commandType = "LIGHT_CONTROL";

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
