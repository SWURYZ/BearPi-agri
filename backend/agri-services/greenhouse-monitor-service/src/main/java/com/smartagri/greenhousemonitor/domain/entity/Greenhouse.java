package com.smartagri.greenhousemonitor.domain.entity;

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

/**
 * 大棚基本信息
 */
@Getter
@Setter
@Entity
@Table(name = "greenhouse")
public class Greenhouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 大棚唯一编码，可与物理标识对应 */
    @Column(nullable = false, length = 64, unique = true)
    private String code;

    /** 大棚名称，如 "一号棚"、"蔬菜区A" */
    @Column(nullable = false, length = 128)
    private String name;

    /** 地理位置或区域描述 */
    @Column(length = 255)
    private String location;

    /** 大棚面积（平方米） */
    private Double areaSqm;

    /** 种植作物类型 */
    @Column(length = 128)
    private String cropType;

    /** 是否启用 */
    @Column(nullable = false)
    private boolean enabled = true;

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
