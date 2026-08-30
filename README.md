# 棚小智（BearPi Smart Greenhouse）

> 面向中小农户的轻量智慧农业系统：用 BearPi 采集大棚环境数据，经华为云 IoTDA 接入云端，由 Java 微服务完成存储、控制、规则与决策，在 React Web 控制台完成监测、告警、辅助决策与可审计控制。

## 项目定位

中小规模大棚常见的问题不是缺少传感器，而是**数据难理解、控制难追溯、经验难复用**。棚小智把“感知—分析—决策—执行—审计”连成闭环：农户既能看到温湿度、光照、土壤等状态，也能在安全约束下控制设备，并获得结合现场数据的场景化建议。

**目标**

- 让一个大棚的传感器数据在 5 分钟内可被远程查看，且异常能被主动告警。
- 让每一次设备控制都可追溯：谁、何时、下发了什么、设备是否回执。
- 让 AI 只做“辅助判断”，不越过安全边界直接无约束操作硬件。

**非目标（明确不做）**

- 不宣称未经独立测试集验证的识别准确率或性能数据。
- 不替代农业技术人员的最终决策；高风险动作必须人工确认。
- 不把演示用的模拟数据伪装成真实设备数据。

## 核心能力

- **设备感知**：BearPi 运行 `D6_iot_cloud_oc3` 固件，连接温湿度、光照、CO₂、土壤温湿度等传感器，经华为云 IoTDA 上报遥测数据。
- **实时监测**：Web 控制台展示实时指标、历史曲线与轻量 3D 数字孪生场景，帮助定位棚内异常。
- **可控执行**：控制指令经参数、设备和动作白名单校验后由 IoTDA 下发，并通过状态上报或命令回执核验结果，全程留痕。
- **规则与告警**：阈值告警、补光计划、复合条件等服务支撑低风险自动化策略。
- **农业 AI 辅助**：病虫害识别服务以 ONNX/CPU 推理作物病害与昆虫图片；农业 Agent 结合传感器上下文流式给出建议。
- **安全边界**：AI 仅生成受限的结构化意图；高风险动作需二次确认并保留命令日志。

## 架构概览

```text
BearPi + 传感器/执行器 (D6_iot_cloud_oc3)
          │ 遥测上报、命令回执
          ▼
     华为云 IoTDA
          │ AMQP 上报消费 / 应用侧命令下发
          ▼
Java 微服务集群 (backend/agri-services)
  ├─ iot-access-service          8082  设备接入、遥测落库、命令下发与回执
  ├─ device-control-service      8083  设备控制
  ├─ light-schedule-service      8084  补光计划
  ├─ agri-agent-service         8085  农业 Agent（SSE 流式回答）
  ├─ greenhouse-monitor-service 8086  大棚监测
  ├─ historical-analysis-service 8087 历史分析
  ├─ composite-condition-service 8088 复合条件
  ├─ smart-decision-service     8089  智能决策
  ├─ face-recognition-service   8090  人脸识别
  └─ threshold-alert-service    8091  阈值告警
          │
  pest-recognition-service (Python/Flask 5000)  病虫害 ONNX 推理
          │
          ▼  HTTP / WebSocket / SSE
React + Vite Web 控制台 (5173)
```

数据底座：MySQL/PostgreSQL（Flyway 迁移）、Redis、Kafka、Nacos 注册与配置、MQTT。

## 目录结构

```text
.
├─ src/                         React 前端（页面、服务层、3D 场景）
├─ backend/
│  ├─ agri-api/                 服务接口与 DTO 契约
│  ├─ agri-common/              公共组件
│  ├─ agri-dependencies/        依赖版本管理
│  ├─ agri-services/            微服务实现（端口 8082~8091）
│  ├─ pest-recognition-service/ Python 病虫害识别（Flask + ONNX）
│  └─ pom.xml                   Maven 父工程
├─ D6_iot_cloud_oc3/            BearPi 设备端固件与 NFC 示例
├─ docs/ guidelines/            设计与协作文档
├─ start-all.ps1                一键拉起全部服务
└─ .env.example                 前端环境变量模板
```

## 技术栈

| 层级 | 选型 |
| --- | --- |
| 端侧硬件 | BearPi（OpenHarmony，C 固件）、农业传感器、继电器/执行器 |
| 设备云 | 华为云 IoTDA（设备身份、属性上报、AMQP 消费、命令下发与回执） |
| 后端 | Java 21、Maven、Spring Boot 3.3.x、Spring Cloud 2023.0.x、Spring Cloud Alibaba Nacos |
| 数据 | MySQL / PostgreSQL、Flyway、Redis、Kafka、MQTT、MyBatis-Plus |
| 前端 | Vite 6、React 18、Tailwind CSS 4、React Three Fiber、Radix UI / MUI、Recharts |
| 实时通信 | HTTP、WebSocket（遥测）、SSE（Agent 流式回答） |
| AI 推理 | ONNX Runtime（CPU）、MobileNetV2 植物病害分类、昆虫分类模型、PyTorch（人脸） |
| 端侧 AI | ONNX Runtime Web、MediaPipe Tasks Vision、face-api.js |
| 决策编排 | agri-agent-service（Java 侧编排，可对接 Coze / LangGraph4j 等） |
| 接口文档 | Springdoc OpenAPI（`/swagger-ui/index.html`） |

## 快速开始

### 环境要求

| 组件 | 版本 |
| --- | --- |
| Node.js | 20+（已验证 24.x 可用） |
| npm | 10+ |
| JDK | 21 |
| Maven | 3.9+ |
| Python | 3.10+（仅病虫害识别服务需要） |
| MySQL / Redis / Kafka / Nacos / MQTT | 可选，连通性检查默认关闭 |

### 1. 前端

```bash
npm install
npm run dev          # http://localhost:5173
```

其他常用命令：

```bash
npm run build        # 生产构建
npm run preview      # 预览构建产物
npm run prepare:face-models   # 下载人脸模型（仅使用人脸相关功能时需要）
```

> Windows PowerShell 若遇到 npm 执行策略报错，请把 `npm` 换成 `npm.cmd`。

从模板创建本地环境变量：

```bash
copy .env.example .env.local
```

```ini
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

- `VITE_API_BASE_URL` 留空时走 Vite 开发代理（`/api` 转发到 `VITE_API_PROXY_TARGET`）。
- `VITE_WS_BASE_URL` 为实时页 WebSocket 地址前缀。

### 2. 后端

构建全部模块：

```bash
cd backend
mvn clean package
```

单独启动 IoT 接入服务（默认 8082）：

```bash
cd backend/agri-services/iot-access-service
mvn spring-boot:run
```

一键拉起全部微服务 + 前端 + 病虫害识别服务（**需先执行 `mvn clean package`**）：

```powershell
./start-all.ps1
```

健康检查：`GET /actuator/health`、探针 `GET /api/v1/smoke/check`、接口文档 `/swagger-ui/index.html`。

后端通过环境变量注入配置，数据库、Redis、Kafka、MQTT、Nacos 的连通性检查**默认关闭**，因此服务可先启动成功。需要接入时再开启，例如：

```bash
APP_ENABLE_DATABASE_CHECK=true
APP_ENABLE_REDIS_CHECK=true
APP_FLYWAY_ENABLED=true
SPRING_DATASOURCE_URL=jdbc:mysql://<host>:3306/<db>
SPRING_DATASOURCE_USERNAME=<user>
SPRING_DATASOURCE_PASSWORD=<password>
REDIS_HOST=127.0.0.1
KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:9092
NACOS_SERVER_ADDR=127.0.0.1:8848
HUAWEICLOUD_IOTDA_AK=<ak>
HUAWEICLOUD_IOTDA_SK=<sk>
HUAWEICLOUD_IOTDA_PROJECT_ID=<project-id>
HUAWEICLOUD_IOTDA_REGION=cn-north-4
```

完整变量清单见 [`backend/README.md`](backend/README.md)。

### 3. 病虫害识别服务

```bash
cd backend/pest-recognition-service
pip install -r requirements.txt
python app.py        # http://localhost:5000
```

### 安全提醒

> 不要将 IoTDA AK/SK、数据库口令、Token 或人脸特征文件提交到仓库。请通过环境变量或密钥管理服务注入，并确认 `.env.local` 未被跟踪。

## 接口约定（草案）

以下接口为本仓库前后端当前使用的契约，**仍属草案，可能随演进调整**；以各服务的 OpenAPI 文档为最终依据。

### 已实现：IoT 接入服务（8082）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/iot/devices/{deviceId}/latest` | 设备最新遥测 |
| GET | `/api/v1/iot/devices/{deviceId}/telemetry?minutes=60` | 历史遥测 |
| GET | `/api/v1/iot/devices/{deviceId}/status` | 设备状态 |
| POST | `/api/v1/iot/commands` | 下发控制命令 |
| PUT | `/api/v1/iot/devices/{deviceId}/actuators` | 设置执行器 |
| GET | `/api/v1/iot/commands/request/{requestId}` | 按请求 ID 查询命令结果 |

### 前端实时契约

```http
GET /api/greenhouses/{greenhouse}/realtime
```

```json
{
  "metrics": {
    "temp": 24.6,
    "humidity": 67.2,
    "light": 8450,
    "co2": 430,
    "soilHumidity": 45.1,
    "soilTemp": 21.3
  }
}
```

```http
GET /api/greenhouses/{greenhouse}/history?sensor=temp&range=24h
```

```json
[{ "time": "08:00", "value": 23.8 }, { "time": "08:30", "value": 24.1 }]
```

```text
WS /ws/realtime?greenhouse={greenhouseId}
```

增量推送与快照同构的 `metrics` 片段。后端不可用时前端会降级为本地模拟数据，页面须明确标注。

### 各微服务基址

| 基址 | 服务 | 端口 |
| --- | --- | --- |
| `/api/v1/device-control` | 设备控制 | 8083 |
| `/api/v1/light-schedule` | 补光计划 | 8084 |
| `/api/v1/agri-agent` | 农业 Agent | 8085 |
| `/api/v1/greenhouse-monitor` | 大棚监测 | 8086 |
| `/api/v1/historical-analysis` | 历史分析 | 8087 |
| `/api/v1/composite-condition` | 复合条件 | 8088 |
| `/api/v1/smart-decision` | 智能决策 | 8089 |
| `/api/v1/threshold-alert` | 阈值告警 | 8091 |

Agent 流式回答（SSE）：

- `POST /api/v1/agri-agent/chat/stream`
- `POST /api/v1/agri-agent/chat/stream/with-image`

### 病虫害识别服务（5000）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/upload` | 上传图片并返回 Top-K 分类结果 |
| GET | `/api/latest` | 读取最近一次识别结果 |
| POST | `/api/clear` | 清除最近结果 |

### 控制链路要求

控制接口只接收经过约束的字段（设备 ID、动作、参数、请求 ID、操作者），**不接受自然语言直接执行**。服务端必须校验权限、设备/动作白名单、阈值与幂等键，并记录下发、回执、超时和最终状态，保证任一命令可审计。

## 数据与 AI 使用说明

- **识别结果只作提示**：病虫害服务以图片分类为当前能力，展示 Top-K 与置信度；低置信度结果仅提示复拍或人工复核，不触发自动控制。
- **摄像头与人脸数据**：视频流、手势、表情等高频交互优先在浏览器本地处理。人脸属于敏感生物特征，需获得明确授权并限定用途、留存期与删除方式，不得随仓库提交特征文件或样本。
- **数据分级与展示**：页面必须区分**实时遥测**、**缓存状态**与**模拟数据**；模拟数据只能用于演示降级，不得伪装为真实设备数据。
- **不夸大效果**：本项目不宣称未经独立测试集验证的识别准确率或性能数据。生产部署前应补充数据集说明、混淆矩阵、Precision/Recall/F1、测试硬件与压测报告。
- **第三方服务**：使用华为云 IoTDA、Coze 及第三方模型/数据集时，需同时遵守其服务条款与许可证。

## 开发路线

- [x] BearPi 设备端固件与 IoTDA 接入样例
- [x] Java 微服务骨架（设备接入、控制、告警、决策、历史分析等）
- [x] React 控制台：实时仪表、历史曲线、3D 数字孪生
- [x] 病虫害 ONNX 推理服务
- [ ] 完善遥测入库、实时推送、控制回执与命令审计的端到端闭环
- [ ] 接入规则引擎与低风险自动化策略
- [ ] 补充病虫害模型评测、数据治理与模型版本管理
- [ ] 增加端到端测试、部署文档与安全基线（鉴权、最小 CORS、密钥管理）

## 贡献规范

欢迎提交 Issue 和 Pull Request。提交前请：

1. 说明改动解决的问题、影响范围与测试方式；
2. 不提交密钥、个人生物特征或真实农户敏感数据；
3. 涉及控制与 AI 决策的改动，补充安全边界、失败处理与回滚策略；
4. 保持提交信息清晰（建议 `feat:` / `fix:` / `docs:` / `refactor:` 前缀），一个 PR 只做一件事；
5. 后端改动请同步更新接口文档，前端改动请同步更新类型与服务层。

## 许可证

本项目以 [MIT License](LICENSE) 开源。

第三方组件与素材的归属见 [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)。使用本项目时，请同时遵守 BearPi、华为云 IoTDA、Coze 以及所用模型、数据集和第三方依赖各自的许可证与服务条款。
