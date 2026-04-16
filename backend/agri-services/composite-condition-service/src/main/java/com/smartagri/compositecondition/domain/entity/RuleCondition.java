package com.smartagri.compositecondition.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * 规则子条件 – 对应单个传感器维度的阈值判断
 * 例如：temperature > 30、humidity < 40、light_intensity >= 500
 */
@Getter
@Setter
@Entity
@Table(name = "rule_condition")
public class RuleCondition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_id", nullable = false)
    private CompositeRule rule;

    /**
     * 传感器指标名称，如 temperature / humidity / light_intensity / co2 等
     */
    @Column(nullable = false, length = 64)
    private String sensorMetric;

    /**
     * 来源设备 ID（传感器所在设备）
     */
    @Column(nullable = false, length = 64)
    private String sourceDeviceId;

    /**
     * 比较运算符：GT / GTE / LT / LTE / EQ / NEQ
     */
    @Column(nullable = false, length = 8)
    private String operator;

    /**
     * 阈值
     */
    @Column(nullable = false)
    private Double threshold;
}
