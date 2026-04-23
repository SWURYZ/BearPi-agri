$ErrorActionPreference = "Continue"
$deviceId = "69d75b1d7f2e6c302f654fea_20031104"
$results = @()

function Test-Api($name, $method, $url, $body) {
    try {
        $params = @{ Uri = $url; Method = $method; TimeoutSec = 8; ContentType = "application/json" }
        if ($PSVersionTable.PSVersion.Major -ge 7) { $params["NoProxy"] = $true }
        if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 5) }
        $resp = Invoke-RestMethod @params
        $json = $resp | ConvertTo-Json -Depth 4 -Compress
        if ($json.Length -gt 300) { $json = $json.Substring(0,300) + "..." }
        Write-Host "[PASS] $name" -ForegroundColor Green
        Write-Host "       $json"
        return "PASS"
    } catch {
        $msg = $_.Exception.Message
        if ($msg.Length -gt 200) { $msg = $msg.Substring(0,200) }
        Write-Host "[FAIL] $name" -ForegroundColor Red
        Write-Host "       $msg"
        return "FAIL"
    }
}

Write-Host "============================================"
Write-Host "  Smart Agri API Test Suite"
Write-Host "============================================"
Write-Host ""

# 2. IoT Access Service (8082)
Write-Host "`n=== 2. iot-access-service (8082) ===" -ForegroundColor Cyan
$r3 = Test-Api "GET /api/v1/iot/devices/{id}/latest" "GET" "http://localhost:8082/api/v1/iot/devices/$deviceId/latest"
$r4 = Test-Api "GET /api/v1/iot/devices/{id}/telemetry" "GET" "http://localhost:8082/api/v1/iot/devices/$deviceId/telemetry?minutes=60"
$r5 = Test-Api "GET /api/v1/iot/devices/{id}/status" "GET" "http://localhost:8082/api/v1/iot/devices/$deviceId/status"
$r6 = Test-Api "GET /api/v1/iot/devices/{id}/capabilities" "GET" "http://localhost:8082/api/v1/iot/devices/$deviceId/capabilities"
$r7 = Test-Api "GET /api/greenhouses/{gh}/realtime" "GET" "http://localhost:8082/api/greenhouses/GH-01/realtime"
$r8 = Test-Api "GET /api/greenhouses/{gh}/history" "GET" "http://localhost:8082/api/greenhouses/GH-01/history?sensor=temp&range=24h"

# 3. Device Control Service (8083)
Write-Host "`n=== 3. device-control-service (8083) ===" -ForegroundColor Cyan
$r9 = Test-Api "GET /api/v1/device-control/devices/{id}/status" "GET" "http://localhost:8083/api/v1/device-control/devices/$deviceId/status"
$r10 = Test-Api "GET /api/v1/device-control/devices/{id}/commands" "GET" "http://localhost:8083/api/v1/device-control/devices/$deviceId/commands"
$r11 = Test-Api "POST /api/v1/device-control/manual" "POST" "http://localhost:8083/api/v1/device-control/manual" @{deviceId=$deviceId;commandType="LIGHT_CONTROL";action="ON"}

# 4. Light Schedule Service (8084)
Write-Host "`n=== 4. light-schedule-service (8084) ===" -ForegroundColor Cyan
$r12 = Test-Api "GET /api/v1/light-schedule/rules" "GET" "http://localhost:8084/api/v1/light-schedule/rules"
$r13 = Test-Api "GET /api/v1/light-schedule/rules/device/{id}" "GET" "http://localhost:8084/api/v1/light-schedule/rules/device/$deviceId"

# 5. Agri Agent Service (8085)
Write-Host "`n=== 5. agri-agent-service (8085) ===" -ForegroundColor Cyan
$r14 = Test-Api "POST /api/v1/agri-agent/chat" "POST" "http://localhost:8085/api/v1/agri-agent/chat" @{message="hello"}

# 6. Greenhouse Monitor Service (8086)
Write-Host "`n=== 6. greenhouse-monitor-service (8086) ===" -ForegroundColor Cyan
$r15 = Test-Api "GET /api/v1/greenhouse-monitor/overview" "GET" "http://localhost:8086/api/v1/greenhouse-monitor/overview"
$r16 = Test-Api "GET /api/v1/greenhouse-monitor/greenhouses" "GET" "http://localhost:8086/api/v1/greenhouse-monitor/greenhouses"
$r17 = Test-Api "GET /api/v1/greenhouse-monitor/devices/connected" "GET" "http://localhost:8086/api/v1/greenhouse-monitor/devices/connected"

# 7. Historical Analysis Service (8087)
Write-Host "`n=== 7. historical-analysis-service (8087) ===" -ForegroundColor Cyan
$r18 = Test-Api "GET /api/greenhouses/{gh}/realtime" "GET" "http://localhost:8087/api/greenhouses/GH-01/realtime"
$r19 = Test-Api "GET /api/greenhouses/{gh}/history" "GET" "http://localhost:8087/api/greenhouses/GH-01/history?sensor=temp&range=24h"

# 8. Composite Condition Service (8088)
Write-Host "`n=== 8. composite-condition-service (8088) ===" -ForegroundColor Cyan
$r20 = Test-Api "GET /api/v1/composite-condition/rules" "GET" "http://localhost:8088/api/v1/composite-condition/rules"

# 9. Face Recognition Service (8090)
Write-Host "`n=== 9. face-recognition-service (8090) ===" -ForegroundColor Cyan
$r21 = Test-Api "GET /api/face/status" "GET" "http://localhost:8090/api/face/status"
$r22 = Test-Api "GET /api/face/records" "GET" "http://localhost:8090/api/face/records"

# Summary
Write-Host "`n============================================"
Write-Host "  TEST SUMMARY"
Write-Host "============================================"
$all = @($r1,$r2,$r3,$r4,$r5,$r6,$r7,$r8,$r9,$r10,$r11,$r12,$r13,$r14,$r15,$r16,$r17,$r18,$r19,$r20,$r21,$r22)
$pass = ($all | Where-Object {$_ -eq "PASS"}).Count
$fail = ($all | Where-Object {$_ -eq "FAIL"}).Count
Write-Host "Total: $($all.Count)  |  " -NoNewline
Write-Host "PASS: $pass" -ForegroundColor Green -NoNewline
Write-Host "  |  " -NoNewline
Write-Host "FAIL: $fail" -ForegroundColor Red
