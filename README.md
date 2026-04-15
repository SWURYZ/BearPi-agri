
# 智慧农业大棚前端

该项目基于 Vite + React + Tailwind CSS，用于智慧农业大棚系统前端展示。

## 1. 本地编译与预览环境

- Node.js: 建议 20+（当前已验证 24.x 可用）
- npm: 建议 10+
- 操作系统: Windows/macOS/Linux

> Windows PowerShell 下如果出现 npm 执行策略错误，请使用 npm.cmd 执行命令。

## 2. 安装与启动

安装依赖:

```bash
npm.cmd install
```

开发模式:

```bash
npm.cmd run dev
```

生产构建:

```bash
npm.cmd run build
```

本地预览构建产物:

```bash
npm.cmd run preview
```

## 3. 后端接入配置

复制环境变量模板:

```bash
copy .env.example .env.local
```

然后按你的后端地址修改 .env.local:

```ini
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

说明:

- VITE_API_PROXY_TARGET: 仅用于 Vite 开发代理，将前端 /api 请求转发到后端。
- VITE_API_BASE_URL: 若你不想走代理，可以直接填后端 HTTP 地址（如 http://localhost:8080）。
- VITE_WS_BASE_URL: 实时页 WebSocket 地址前缀。

## 4. 当前实时页后端协议约定

实时监测页面已支持后端优先、模拟兜底。

HTTP 快照接口:

- GET /api/greenhouses/:greenhouse/realtime

返回示例:

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

HTTP 历史接口:

- GET /api/greenhouses/:greenhouse/history?sensor=temp&range=24h

返回示例:

```json
[
  { "time": "08:00", "value": 23.8 },
  { "time": "08:30", "value": 24.1 }
]
```

WebSocket 实时推送:

- WS /ws/realtime?greenhouse=1%E5%8F%B7%E5%A4%A7%E6%A3%9A

消息示例:

```json
{
  "metrics": {
    "temp": 24.7,
    "humidity": 66.9,
    "co2": 428
  }
}
```

如果后端不可用，页面会自动切换到本地模拟数据，确保演示不受阻。
  