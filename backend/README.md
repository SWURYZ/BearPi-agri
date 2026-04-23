# Smart Agri Backend

本目录按照《智慧农业项目实施与团队协作手册》搭建了一个 Maven 父工程，包含以 IoT 接入为核心的多个微服务。

- `iot-access-service`：从旧项目 `bearpi-cv` 收敛而来，负责华为 IoTDA 设备接入、AMQP 上报消费、命令下发和设备状态查询。

## 目录结构

```text
backend/
├─ pom.xml
├─ agri-dependencies/
├─ agri-common/
├─ agri-api/
└─ agri-services/
   └─ iot-access-service/
```

## 已包含技术栈

- Spring Boot 3.3.x
- Spring Cloud 2023.0.x
- Spring Cloud Alibaba Nacos
- MyBatis-Plus
- MySQL
- Flyway
- Redis
- Kafka
- MQTT
- OpenAPI

## 本地构建

```bash
mvn clean package
```

## 启动 IoT 接入服务

```bash
cd agri-services/iot-access-service
mvn spring-boot:run
```

默认端口为 `8082`。

### IoT 接入服务职责

- 消费华为云 IoTDA 的 AMQP 上报消息
- 解析 `Agriculture` 服务属性并写入本地库
- 通过华为云 IoTDA 应用侧 API 向设备下发控制消息
- 接收命令状态回执并更新本地命令日志

### IoT 接入服务接口

- `GET /api/v1/iot/devices/{deviceId}/latest`
- `GET /api/v1/iot/devices/{deviceId}/telemetry?minutes=60`
- `GET /api/v1/iot/devices/{deviceId}/status`
- `POST /api/v1/iot/commands`
- `PUT /api/v1/iot/devices/{deviceId}/actuators`
- `GET /api/v1/iot/commands/request/{requestId}`

## 探针接口

- `GET /api/v1/smoke/check`
- `GET /actuator/health`
- `GET /swagger-ui/index.html`

默认情况下，数据库、Redis、Kafka、MQTT、Nacos 连通性检查均为关闭状态，服务可以先启动成功。

如需开启某项检查，可在启动前设置对应环境变量：

```bash
APP_ENABLE_DATABASE_CHECK=true
APP_ENABLE_REDIS_CHECK=true
APP_ENABLE_KAFKA_CHECK=true
APP_ENABLE_MQTT_CHECK=true
APP_ENABLE_NACOS_CHECK=true
APP_FLYWAY_ENABLED=true
```

常用基础连接变量：

```bash
SPRING_DATASOURCE_URL=jdbc:mysql://47.108.58.107:3306/dream6?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=<your-password>
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:9092
MQTT_BROKER=tcp://127.0.0.1:1883
MQTT_USERNAME=admin
MQTT_PASSWORD=public
NACOS_SERVER_ADDR=127.0.0.1:8848
NACOS_BASE_URL=http://127.0.0.1:8848
HUAWEICLOUD_IOTDA_COMMAND_ENABLED=false
HUAWEICLOUD_IOTDA_AK=
HUAWEICLOUD_IOTDA_SK=
HUAWEICLOUD_IOTDA_PROJECT_ID=
HUAWEICLOUD_IOTDA_REGION=cn-north-4
HUAWEICLOUD_IOTDA_ENDPOINT=
HUAWEICLOUD_IOTDA_AMQP_ENABLED=false
HUAWEICLOUD_IOTDA_AMQP_URL=
HUAWEICLOUD_IOTDA_AMQP_ACCESS_KEY=
HUAWEICLOUD_IOTDA_AMQP_ACCESS_CODE=
HUAWEICLOUD_IOTDA_AMQP_QUEUE_NAME=bearpi-update
```
