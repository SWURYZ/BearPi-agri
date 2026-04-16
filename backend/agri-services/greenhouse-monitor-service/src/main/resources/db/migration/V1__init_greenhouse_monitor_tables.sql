-- V1: 初始化多大棚统一监控与设备管理服务表结构

CREATE TABLE IF NOT EXISTS greenhouse (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    location    VARCHAR(255),
    area_sqm    DOUBLE,
    crop_type   VARCHAR(128),
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL
);

-- 大棚传感器数据快照（每个大棚每个指标仅保留最新一条，pk = greenhouseCode#metric）
CREATE TABLE IF NOT EXISTS greenhouse_sensor_snapshot (
    pk                VARCHAR(160) PRIMARY KEY,
    greenhouse_code   VARCHAR(64)  NOT NULL,
    metric            VARCHAR(64)  NOT NULL,
    value             DOUBLE       NOT NULL DEFAULT 0.0,
    unit              VARCHAR(32),
    source_device_id  VARCHAR(64),
    reported_at       TIMESTAMP    NOT NULL,
    INDEX idx_gss_greenhouse (greenhouse_code)
);

-- 设备与大棚绑定映射表
CREATE TABLE IF NOT EXISTS device_greenhouse_mapping (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id       VARCHAR(64)  NOT NULL UNIQUE,
    device_name     VARCHAR(128),
    device_type     VARCHAR(64),
    greenhouse_code VARCHAR(64)  NOT NULL,
    status          VARCHAR(32)  NOT NULL DEFAULT 'BOUND',
    bound_at        TIMESTAMP    NOT NULL,
    unbound_at      TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL,
    INDEX idx_dgm_greenhouse (greenhouse_code),
    INDEX idx_dgm_status (status)
);
