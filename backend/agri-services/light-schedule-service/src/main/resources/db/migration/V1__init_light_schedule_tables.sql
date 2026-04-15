create table if not exists light_schedule_rule (
    id bigint auto_increment primary key,
    device_id varchar(64) not null,
    rule_name varchar(64) not null,
    turn_on_time time not null,
    turn_off_time time not null,
    enabled boolean not null default true,
    repeat_mode varchar(32),
    created_at timestamp not null,
    updated_at timestamp,
    index idx_device_id (device_id),
    index idx_enabled (enabled)
);

create table if not exists light_schedule_execution_log (
    id bigint auto_increment primary key,
    rule_id bigint not null,
    device_id varchar(64) not null,
    action varchar(16) not null,
    status varchar(32) not null,
    cloud_message_id varchar(64),
    error_message varchar(255),
    executed_at timestamp not null,
    index idx_rule_id (rule_id),
    index idx_executed_at (executed_at)
);
