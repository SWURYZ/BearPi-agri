create table if not exists iot_device_telemetry (
    id bigint auto_increment primary key,
    device_id varchar(64) not null,
    service_id varchar(64),
    temperature double precision,
    humidity double precision,
    luminance double precision,
    led_status varchar(32),
    motor_status varchar(32),
    report_time timestamp not null,
    raw_payload text,
    index idx_iot_device_telemetry_device_time (device_id, report_time desc)
);

create table if not exists iot_device_command_log (
    id bigint auto_increment primary key,
    device_id varchar(64) not null,
    request_id varchar(64),
    cloud_command_id varchar(64),
    command_type varchar(64) not null,
    status varchar(32) not null,
    command_payload text,
    error_message varchar(255),
    created_at timestamp not null,
    updated_at timestamp,
    unique key uk_iot_device_command_log_request_id (request_id),
    unique key uk_iot_device_command_log_cloud_command_id (cloud_command_id)
);
