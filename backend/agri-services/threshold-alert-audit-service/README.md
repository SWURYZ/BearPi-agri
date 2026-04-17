# threshold-alert-audit-service

## 服务定位

独立微服务，负责温湿度阈值告警与审计，覆盖以下业务链路：

1. 农户配置设备温湿度阈值上下限。
2. 后端接收实时温湿度值并与阈值比对。
3. 触发越界即告警。
4. 记录告警时间、设备ID、异常值和阈值范围。
5. 管理员查询并导出告警审计记录。

## 关键接口

- `POST /api/v1/threshold-alert/rules` 新增或更新设备阈值规则
- `GET /api/v1/threshold-alert/rules` 查询全部阈值规则
- `GET /api/v1/threshold-alert/rules/device/{deviceId}` 查询单设备阈值规则
- `POST /api/v1/threshold-alert/readings/ingest` 摄入实时数据并触发告警
- `GET /api/v1/threshold-alert/alerts` 查询告警记录（支持时间范围/设备过滤）
- `GET /api/v1/threshold-alert/alerts/export` 导出告警记录CSV

## 默认端口

`8085`

## 构建测试

在 `backend` 目录执行：

```bash
mvn -pl agri-services/threshold-alert-audit-service -am test
```
