package com.smartagri.compositecondition.domain.entity;

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

/**
 * 联动操作日志 – 记录每次规则命中并下发指令的完整历史
 */
@Getter
@Setter
@Entity
@Table(name = "linkage_action_log")
public class LinkageActionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ruleId;

    @Column(nullable = false, length = 128)
    private String ruleName;

    /** 触发时各子条件当前传感器值的快照（JSON 字符串） */
    @Column(columnDefinition = "TEXT")
    private String conditionSnapshot;

    @Column(nullable = false, length = 64)
    private String targetDeviceId;

    @Column(nullable = false, length = 64)
    private String commandType;

    @Column(nullable = false, length = 64)
    private String commandAction;

    /** 指令下发结果：SENT / SKIPPED / FAILED */
    @Column(nullable = false, length = 32)
    private String dispatchStatus;

    /** 云平台消息 ID */
    @Column(length = 64)
    private String cloudMessageId;

    @Column(length = 255)
    private String errorMessage;

    @Column(nullable = false)
    private LocalDateTime triggeredAt;

    @PrePersist
    void prePersist() {
        if (triggeredAt == null) {
            triggeredAt = LocalDateTime.now();
        }
    }
}
