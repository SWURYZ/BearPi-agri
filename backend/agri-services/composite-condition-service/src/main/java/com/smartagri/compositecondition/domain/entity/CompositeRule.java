package com.smartagri.compositecondition.domain.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 复合条件联动规则
 * 包含多个传感器子条件，子条件之间用 AND/OR 逻辑组合，
 * 满足时自动向关联设备下发动作指令。
 */
@Getter
@Setter
@Entity
@Table(name = "composite_rule")
public class CompositeRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 规则名称，便于前端展示 */
    @Column(nullable = false, length = 128)
    private String name;

    /** 规则描述 */
    @Column(length = 512)
    private String description;

    /**
     * 子条件之间的逻辑关系：AND（全部满足）/ OR（任意满足）
     */
    @Column(nullable = false, length = 8)
    private String logicOperator = "AND";

    /** 规则是否启用 */
    @Column(nullable = false)
    private boolean enabled = true;

    /** 触发时下发的目标设备 ID */
    @Column(nullable = false, length = 64)
    private String targetDeviceId;

    /** 触发时的指令类型，如 LIGHT_CONTROL / MOTOR_CONTROL 等 */
    @Column(nullable = false, length = 64)
    private String commandType;

    /** 触发时的指令动作，如 ON / OFF 等 */
    @Column(nullable = false, length = 64)
    private String commandAction;

    @OneToMany(mappedBy = "rule", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<RuleCondition> conditions = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
