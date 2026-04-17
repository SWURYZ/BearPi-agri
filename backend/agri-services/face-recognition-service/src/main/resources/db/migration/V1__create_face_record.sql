-- 人脸注册记录表
CREATE TABLE IF NOT EXISTS `face_record` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `person_id`   VARCHAR(64)  NOT NULL COMMENT '人员唯一标识',
    `person_name` VARCHAR(128) NOT NULL COMMENT '人员姓名',
    `embedding`   LONGBLOB     NOT NULL COMMENT '人脸特征向量 (序列化 float[])',
    `image_path`  VARCHAR(512)          COMMENT '人脸图片存储路径',
    `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_person_id` (`person_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人脸识别注册记录';
