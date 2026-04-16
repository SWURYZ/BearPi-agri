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

@Getter
@Setter
@Entity
@Table(name = "light_schedule_execution_log")
public class ScheduleExecutionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ruleId;

    @Column(nullable = false, length = 64)
    private String deviceId;

    @Column(nullable = false, length = 16)
    private String action;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(length = 64)
    private String cloudMessageId;

    @Column(length = 255)
    private String errorMessage;

    @Column(nullable = false)
    private LocalDateTime executedAt;

    @PrePersist
    void prePersist() {
        if (executedAt == null) {
            executedAt = LocalDateTime.now();
        }
    }
}
