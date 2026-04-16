create table if not exists smoke_probe_log (
    id bigint auto_increment primary key,
    component_name varchar(64) not null,
    status varchar(16) not null,
    checked_at timestamp not null default current_timestamp
);
