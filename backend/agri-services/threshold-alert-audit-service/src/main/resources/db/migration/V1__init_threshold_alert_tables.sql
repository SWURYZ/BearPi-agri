create table if not exists threshold_rule (
    id bigint auto_increment primary key,
    device_id varchar(64) not null,
    temperature_min decimal(10,2) not null,
    temperature_max decimal(10,2) not null,
    humidity_min decimal(10,2) not null,
    humidity_max decimal(10,2) not null,
    enabled boolean not null default true,
    created_at timestamp not null,
    updated_at timestamp,
    unique key uk_threshold_rule_device_id (device_id)
);

create table if not exists threshold_alert_record (
    id bigint auto_increment primary key,
    device_id varchar(64) not null,
    metric_type varchar(32) not null,
    current_value decimal(10,2) not null,
    min_threshold decimal(10,2) not null,
    max_threshold decimal(10,2) not null,
    alert_message varchar(255) not null,
    alerted_at timestamp not null,
    index idx_alert_device_id (device_id),
    index idx_alert_metric_type (metric_type),
    index idx_alert_alerted_at (alerted_at)
);
