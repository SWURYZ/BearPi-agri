# ============================================================
# BearPi-agri 全服务启动脚本
# 前端: http://localhost:5173
# 后端服务端口: 8081~8091
# ============================================================

$root = $PSScriptRoot
$backend = Join-Path $root "backend\agri-services"

# 服务列表: [名称, 目标端口, JAR目录名]
$services = @(
    @{ Name="iot-access-service";             Port=8082; Dir="iot-access-service" }
    @{ Name="device-control-service";         Port=8083; Dir="device-control-service" }
    @{ Name="light-schedule-service";         Port=8084; Dir="light-schedule-service" }
    @{ Name="agri-agent-service";             Port=8085; Dir="agri-agent-service" }
    @{ Name="greenhouse-monitor-service";     Port=8086; Dir="greenhouse-monitor-service" }
    @{ Name="historical-analysis-service";    Port=8087; Dir="historical-analysis-service" }
    @{ Name="composite-condition-service";    Port=8088; Dir="composite-condition-service" }
    @{ Name="smart-decision-service";         Port=8089; Dir="smart-decision-service" }
    @{ Name="face-recognition-service";       Port=8090; Dir="face-recognition-service" }
    @{ Name="threshold-alert-service";         Port=8091; Dir="threshold-alert-service" }
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动 BearPi-agri 全部服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 启动各后端微服务
foreach ($svc in $services) {
    $jarDir = Join-Path $backend "$($svc.Dir)\target"
    $jar = Get-ChildItem $jarDir -Filter "*-SNAPSHOT.jar" -ErrorAction SilentlyContinue |
           Where-Object { $_.Name -notlike "*sources*" } |
           Sort-Object LastWriteTime -Descending |
           Select-Object -First 1

    if ($null -eq $jar) {
        Write-Host "[SKIP] $($svc.Name): 未找到 JAR，请先执行 mvn clean package" -ForegroundColor Yellow
        continue
    }

    # face-recognition-service 需从 backend 目录启动（模型相对路径），且需要更多内存加载 PyTorch 模型
    # 其余服务限制 -Xmx256m 避免 12 个 JVM 同时运行时 OOM
    $jvmArgs = if ($svc.Name -eq "face-recognition-service") { "-Xms128m -Xmx512m" } else { "-Xms32m -Xmx256m" }
    $workDir = if ($svc.Name -eq "face-recognition-service") { "$root\backend" } else { $root }
    $cmd = "Set-Location '$workDir'; java $jvmArgs -jar `"$($jar.FullName)`" --server.port=$($svc.Port)"

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting $($svc.Name) on port $($svc.Port)' -ForegroundColor Green; $cmd" -WindowStyle Normal
    Write-Host "[OK] $($svc.Name) => http://localhost:$($svc.Port)  (新窗口已打开)" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}

# 启动前端
Write-Host ""
Write-Host "启动前端 (Vite)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; npm run dev" -WindowStyle Normal
Write-Host "[OK] 前端 => http://localhost:5173  (新窗口已打开)" -ForegroundColor Green

# 启动害虫识别 (Flask + YOLO) 服务
Write-Host ""
Write-Host "启动害虫识别服务 (pest-recognition / Flask :5000)..." -ForegroundColor Cyan
$pestDir = Join-Path $root "backend\pest-recognition-service"
if (Test-Path (Join-Path $pestDir "app.py")) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting pest-recognition on port 5000' -ForegroundColor Green; Set-Location '$pestDir'; python app.py" -WindowStyle Normal
    Write-Host "[OK] pest-recognition => http://localhost:5000  (新窗口已打开)" -ForegroundColor Green
} else {
    Write-Host "[SKIP] pest-recognition-service 未找到，跳过" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  所有服务已在独立窗口中启动" -ForegroundColor Cyan
Write-Host "  端口汇总:" -ForegroundColor Cyan
Write-Host "    前端:                         5173" -ForegroundColor White
    # tech-stack-smoke-service:     8081  (默认不启动)
    Write-Host "    iot-access-service:           8082" -ForegroundColor White
Write-Host "    device-control-service:       8083" -ForegroundColor White
Write-Host "    light-schedule-service:       8084" -ForegroundColor White
Write-Host "    agri-agent-service:           8085" -ForegroundColor White
Write-Host "    greenhouse-monitor-service:   8086" -ForegroundColor White
Write-Host "    historical-analysis-service:  8087" -ForegroundColor White
Write-Host "    composite-condition-service:  8088" -ForegroundColor White
Write-Host "    smart-decision-service:       8089" -ForegroundColor White
Write-Host "    face-recognition-service:     8090" -ForegroundColor White
Write-Host "    threshold-alert-service:      8091" -ForegroundColor White
Write-Host "    pest-recognition (Flask):     5000" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
