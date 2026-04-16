package com.smartagri.greenhousemonitor.controller;

import com.smartagri.common.model.ApiResponse;
import com.smartagri.greenhousemonitor.dto.DeviceBindRequest;
import com.smartagri.greenhousemonitor.dto.DeviceMappingResponse;
import com.smartagri.greenhousemonitor.dto.DeviceScanBindRequest;
import com.smartagri.greenhousemonitor.dto.GreenhouseOverviewResponse;
import com.smartagri.greenhousemonitor.dto.GreenhouseRequest;
import com.smartagri.greenhousemonitor.dto.GreenhouseResponse;
import com.smartagri.greenhousemonitor.dto.SensorSnapshotRequest;
import com.smartagri.greenhousemonitor.service.GreenhouseMonitorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 多大棚统一监控与设备管理 Controller
 *
 * <p>业务七流程：
 * 管理员登录查看全场概况 → 后端汇总所有大棚最新温湿度、光照等数据
 * → 前端以大屏或卡片形式分区展示 | 扫描新设备二维码绑定 → 更新设备映射表
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/greenhouse-monitor")
public class GreenhouseMonitorController {

    private final GreenhouseMonitorService monitorService;

    // ======== 多大棚概览（大屏/卡片展示）========

    /**
     * 汇总查询所有大棚最新传感器数据（温湿度、光照等）
     * 前端以大屏或卡片形式分区展示
     */
    @GetMapping("/overview")
    public ApiResponse<List<GreenhouseOverviewResponse>> overviewAll() {
        return ApiResponse.success(monitorService.overviewAll());
    }

    /**
     * 查询指定大棚的最新传感器数据概览
     */
    @GetMapping("/overview/{code}")
    public ApiResponse<GreenhouseOverviewResponse> overviewByCode(@PathVariable("code") String code) {
        return ApiResponse.success(monitorService.overviewByCode(code));
    }

    // ======== 大棚基本信息管理 ========

    /**
     * 查询所有大棚列表
     */
    @GetMapping("/greenhouses")
    public ApiResponse<List<GreenhouseResponse>> listGreenhouses() {
        return ApiResponse.success(monitorService.listAll());
    }

    /**
     * 查询单个大棚详情
     */
    @GetMapping("/greenhouses/{code}")
    public ApiResponse<GreenhouseResponse> getGreenhouse(@PathVariable("code") String code) {
        return ApiResponse.success(monitorService.getByCode(code));
    }

    /**
     * 新增大棚
     */
    @PostMapping("/greenhouses")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<GreenhouseResponse> createGreenhouse(@Valid @RequestBody GreenhouseRequest request) {
        return ApiResponse.success(monitorService.create(request));
    }

    /**
     * 更新大棚信息
     */
    @PutMapping("/greenhouses/{code}")
    public ApiResponse<GreenhouseResponse> updateGreenhouse(
            @PathVariable("code") String code,
            @Valid @RequestBody GreenhouseRequest request) {
        return ApiResponse.success(monitorService.update(code, request));
    }

    /**
     * 删除大棚
     */
    @DeleteMapping("/greenhouses/{code}")
    public ApiResponse<String> deleteGreenhouse(@PathVariable("code") String code) {
        monitorService.delete(code);
        return ApiResponse.success("大棚已删除");
    }

    // ======== 传感器数据接入 ========

    /**
     * 上报大棚传感器数据（温度、湿度、光照等指标），覆盖写入最新快照
     */
    @PostMapping("/sensor-data")
    public ApiResponse<String> ingestSensorData(@Valid @RequestBody SensorSnapshotRequest request) {
        monitorService.ingestSnapshot(request);
        return ApiResponse.success("传感器数据已更新");
    }

    // ======== 设备绑定管理（扫码绑定/解绑）========

    /**
     * 扫描新设备二维码，将设备绑定到指定大棚，更新设备映射表
     */
    @PostMapping("/devices/bind")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DeviceMappingResponse> bindDevice(@Valid @RequestBody DeviceBindRequest request) {
        return ApiResponse.success(monitorService.bindDevice(request));
    }

    /**
     * 解除设备与大棚的绑定关系
     */
    @PostMapping("/devices/{deviceId}/unbind")
    public ApiResponse<DeviceMappingResponse> unbindDevice(@PathVariable("deviceId") String deviceId) {
        return ApiResponse.success(monitorService.unbindDevice(deviceId));
    }

    /**
     * 查询指定大棚下所有绑定/历史设备
     */
    @GetMapping("/greenhouses/{code}/devices")
    public ApiResponse<List<DeviceMappingResponse>> listDevices(@PathVariable("code") String code) {
        return ApiResponse.success(monitorService.listDevices(code));
    }

    /**
     * Query currently connected devices in the specified greenhouse.
     */
    @GetMapping("/greenhouses/{code}/devices/connected")
    public ApiResponse<List<DeviceMappingResponse>> listConnectedDevices(@PathVariable("code") String code) {
        return ApiResponse.success(monitorService.listConnectedDevices(code));
    }

    /**
     * Query currently connected devices across all greenhouses.
     */
    @GetMapping("/devices/connected")
    public ApiResponse<List<DeviceMappingResponse>> listAllConnectedDevices() {
        return ApiResponse.success(monitorService.listAllConnectedDevices());
    }

    /**
     * Query currently connected devices in default greenhouse #1.
     */
    @GetMapping("/greenhouses/default/devices/connected")
    public ApiResponse<List<DeviceMappingResponse>> listConnectedDevicesInDefaultGreenhouse() {
        return ApiResponse.success(monitorService.listConnectedDevicesInDefaultGreenhouse());
    }

    /**
     * Scan QR and bind device into target greenhouse.
     */
    @PostMapping("/devices/scan-bind")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DeviceMappingResponse> scanBindDevice(@Valid @RequestBody DeviceScanBindRequest request) {
        return ApiResponse.success(monitorService.scanBindDevice(request));
    }

    /**
     * 查询单台设备的绑定映射信息
     */
    @GetMapping("/devices/{deviceId}")
    public ApiResponse<DeviceMappingResponse> getDeviceMapping(@PathVariable("deviceId") String deviceId) {
        return ApiResponse.success(monitorService.getDeviceMapping(deviceId));
    }
}
