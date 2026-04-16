create table if not exists device_control_command (
    id bigint auto_increment primary key,
    device_id varchar(64) not null,
    request_id varchar(64),
    cloud_message_id varchar(64),
    command_type varchar(64) not null,
    command_payload text,
    status varchar(32) not null,
    result_code varchar(32),
    error_message varchar(255),
    created_at timestamp not null,
    updated_at timestamp,
    unique key uk_request_id (request_id),
    index idx_device_id (device_id)
);

create table if not exists device_status (
    id bigint auto_increment primary key,
    device_id varchar(64) not null,
    led_status varchar(32),
    motor_status varchar(32),
    last_updated timestamp not null,
    unique key uk_device_id (device_id)
);
