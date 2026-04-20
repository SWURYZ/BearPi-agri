-- 为 app_user 添加 registered_by 字段（记录注册负责人）
ALTER TABLE `app_user`
    ADD COLUMN `registered_by` VARCHAR(50) NULL COMMENT '负责注册该用户的农户用户名' AFTER `role`;

-- 登录日志表
CREATE TABLE IF NOT EXISTS `login_log` (
    `id`           BIGINT       NOT NULL AUTO_INCREMENT,
    `user_id`      BIGINT       NOT NULL COMMENT '登录用户ID',
    `username`     VARCHAR(50)  NOT NULL COMMENT '登录用户名',
    `display_name` VARCHAR(50)           COMMENT '显示姓名',
    `login_type`   VARCHAR(10)  NOT NULL COMMENT '登录方式: password / face',
    `login_time`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_login_time` (`login_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户登录日志';
