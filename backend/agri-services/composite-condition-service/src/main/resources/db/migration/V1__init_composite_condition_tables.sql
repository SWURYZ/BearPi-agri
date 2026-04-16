-- V1: 初始化复合条件联动控制服务表结构

CREATE TABLE IF NOT EXISTS composite_rule (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(128) NOT NULL,
    description  VARCHAR(512),
    logic_operator VARCHAR(8) NOT NULL DEFAULT 'AND',
    enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    target_device_id VARCHAR(64) NOT NULL,
    command_type VARCHAR(64) NOT NULL,
    command_action VARCHAR(64) NOT NULL,
    created_at   TIMESTAMP NOT NULL,
    updated_at   TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_condition (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_id          BIGINT NOT NULL,
    sensor_metric    VARCHAR(64) NOT NULL,
    source_device_id VARCHAR(64) NOT NULL,
    operator         VARCHAR(8) NOT NULL,
    threshold        DOUBLE NOT NULL,
    CONSTRAINT fk_rc_rule FOREIGN KEY (rule_id) REFERENCES composite_rule(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sensor_latest_data (
    pk          VARCHAR(128) PRIMARY KEY,
    device_id   VARCHAR(64) NOT NULL,
    metric      VARCHAR(64) NOT NULL,
    metric_value DOUBLE NOT NULL,
    reported_at TIMESTAMP NOT NULL,
    INDEX idx_sld_device (device_id)
);

CREATE TABLE IF NOT EXISTS linkage_action_log (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_id            BIGINT NOT NULL,
    rule_name          VARCHAR(128) NOT NULL,
    condition_snapshot TEXT,
    target_device_id   VARCHAR(64) NOT NULL,
    command_type       VARCHAR(64) NOT NULL,
    command_action     VARCHAR(64) NOT NULL,
    dispatch_status    VARCHAR(32) NOT NULL,
    cloud_message_id   VARCHAR(64),
    error_message      VARCHAR(255),
    triggered_at       TIMESTAMP NOT NULL,
    INDEX idx_lal_rule (rule_id),
    INDEX idx_lal_device (target_device_id)
);
