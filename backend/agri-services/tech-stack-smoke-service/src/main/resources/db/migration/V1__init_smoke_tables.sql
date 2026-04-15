create table if not exists smoke_probe_log (
    id bigserial primary key,
    component_name varchar(64) not null,
    status varchar(16) not null,
    checked_at timestamp not null default current_timestamp
);
