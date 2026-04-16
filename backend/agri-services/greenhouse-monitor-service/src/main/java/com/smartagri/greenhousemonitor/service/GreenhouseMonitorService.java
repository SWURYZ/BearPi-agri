package com.smartagri.greenhousemonitor.service;

import com.smartagri.greenhousemonitor.domain.entity.DeviceGreenhouseMapping;
import com.smartagri.greenhousemonitor.domain.entity.Greenhouse;
import com.smartagri.greenhousemonitor.domain.entity.GreenhouseSensorSnapshot;
import com.smartagri.greenhousemonitor.domain.repository.DeviceGreenhouseMappingRepository;
import com.smartagri.greenhousemonitor.domain.repository.GreenhouseRepository;
import com.smartagri.greenhousemonitor.domain.repository.GreenhouseSensorSnapshotRepository;
import com.smartagri.greenhousemonitor.dto.DeviceBindRequest;
import com.smartagri.greenhousemonitor.dto.DeviceMappingResponse;
import com.smartagri.greenhousemonitor.dto.GreenhouseOverviewResponse;
import com.smartagri.greenhousemonitor.dto.GreenhouseRequest;
import com.smartagri.greenhousemonitor.dto.GreenhouseResponse;
import com.smartagri.greenhousemonitor.dto.SensorSnapshotRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GreenhouseMonitorService {

    private final GreenhouseRepository greenhouseRepository;
    private final GreenhouseSensorSnapshotRepository snapshotRepository;
    private final DeviceGreenhouseMappingRepository mappingRepository;

    // ---- 大棚管理 ----

    public List<GreenhouseResponse> listAll() {
        return greenhouseRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public GreenhouseResponse getByCode(String code) {
        return greenhouseRepository.findByCode(code)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("大棚不存在: " + code));
    }

    @Transactional
    public GreenhouseResponse create(GreenhouseRequest request) {
        if (greenhouseRepository.findByCode(request.code()).isPresent()) {
            throw new IllegalArgumentException("大棚编码已存在: " + request.code());
        }
        Greenhouse greenhouse = new Greenhouse();
        applyRequest(greenhouse, request);
        return toResponse(greenhouseRepository.save(greenhouse));
    }

    @Transactional
    public GreenhouseResponse update(String code, GreenhouseRequest request) {
        Greenhouse greenhouse = greenhouseRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("大棚不存在: " + code));
        applyRequest(greenhouse, request);
        return toResponse(greenhouseRepository.save(greenhouse));
    }

    @Transactional
    public void delete(String code) {
        Greenhouse greenhouse = greenhouseRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("大棚不存在: " + code));
        greenhouseRepository.delete(greenhouse);
    }

    // ---- 多大棚概览（汇总最新传感器数据）----

    /**
     * 汇总所有大棚的最新传感器数据，用于大屏或卡片展示
     */
    public List<GreenhouseOverviewResponse> overviewAll() {
        return greenhouseRepository.findByEnabled(true).stream()
                .map(this::buildOverview)
                .collect(Collectors.toList());
    }

    public GreenhouseOverviewResponse overviewByCode(String code) {
        Greenhouse greenhouse = greenhouseRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("大棚不存在: " + code));
        return buildOverview(greenhouse);
    }

    private GreenhouseOverviewResponse buildOverview(Greenhouse greenhouse) {
        List<GreenhouseSensorSnapshot> snapshots =
                snapshotRepository.findByGreenhouseCode(greenhouse.getCode());

        List<GreenhouseOverviewResponse.SensorMetricEntry> metrics = snapshots.stream()
                .map(s -> new GreenhouseOverviewResponse.SensorMetricEntry(
                        s.getMetric(), s.getValue(), s.getUnit(),
                        s.getSourceDeviceId(), s.getReportedAt()))
                .collect(Collectors.toList());

        int boundCount = mappingRepository
                .findByGreenhouseCodeAndStatus(greenhouse.getCode(), "BOUND").size();

        return new GreenhouseOverviewResponse(
                greenhouse.getId(), greenhouse.getCode(), greenhouse.getName(),
                greenhouse.getLocation(), greenhouse.getAreaSqm(), greenhouse.getCropType(),
                greenhouse.isEnabled(), metrics, boundCount);
    }

    // ---- 传感器数据接入 ----

    @Transactional
    public void ingestSnapshot(SensorSnapshotRequest request) {
        String pk = request.greenhouseCode() + "#" + request.metric();
        GreenhouseSensorSnapshot snapshot = snapshotRepository.findById(pk)
                .orElseGet(() -> {
                    GreenhouseSensorSnapshot s = new GreenhouseSensorSnapshot();
                    s.setPk(pk);
                    s.setGreenhouseCode(request.greenhouseCode());
                    s.setMetric(request.metric());
                    return s;
                });
        snapshot.setValue(request.value() != null ? request.value() : 0.0);
        snapshot.setUnit(request.unit());
        snapshot.setSourceDeviceId(request.sourceDeviceId());
        snapshotRepository.save(snapshot);
        log.debug("[传感器] 数据更新, greenhouse={}, metric={}, value={}",
                request.greenhouseCode(), request.metric(), request.value());
    }

    // ---- 设备绑定管理 ----

    /**
     * 扫码绑定新设备到大棚（若已绑定则更新大棚归属）
     */
    @Transactional
    public DeviceMappingResponse bindDevice(DeviceBindRequest request) {
        DeviceGreenhouseMapping mapping = mappingRepository.findByDeviceId(request.deviceId())
                .orElseGet(() -> {
                    DeviceGreenhouseMapping m = new DeviceGreenhouseMapping();
                    m.setDeviceId(request.deviceId());
                    return m;
                });
        mapping.setDeviceName(request.deviceName());
        mapping.setDeviceType(request.deviceType());
        mapping.setGreenhouseCode(request.greenhouseCode());
        mapping.setStatus("BOUND");
        mapping.setUnboundAt(null);
        return toMappingResponse(mappingRepository.save(mapping));
    }

    /**
     * 解绑设备
     */
    @Transactional
    public DeviceMappingResponse unbindDevice(String deviceId) {
        DeviceGreenhouseMapping mapping = mappingRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备未绑定: " + deviceId));
        mapping.setStatus("UNBOUND");
        mapping.setUnboundAt(LocalDateTime.now());
        return toMappingResponse(mappingRepository.save(mapping));
    }

    /**
     * 查询大棚下的所有绑定设备
     */
    public List<DeviceMappingResponse> listDevices(String greenhouseCode) {
        return mappingRepository.findByGreenhouseCode(greenhouseCode).stream()
                .map(this::toMappingResponse)
                .collect(Collectors.toList());
    }

    /**
     * 查询单台设备的绑定状态
     */
    public DeviceMappingResponse getDeviceMapping(String deviceId) {
        return mappingRepository.findByDeviceId(deviceId)
                .map(this::toMappingResponse)
                .orElseThrow(() -> new IllegalArgumentException("设备映射不存在: " + deviceId));
    }

    // ---- Mapping helpers ----

    private void applyRequest(Greenhouse greenhouse, GreenhouseRequest request) {
        greenhouse.setCode(request.code());
        greenhouse.setName(request.name());
        greenhouse.setLocation(request.location());
        greenhouse.setAreaSqm(request.areaSqm());
        greenhouse.setCropType(request.cropType());
        greenhouse.setEnabled(request.enabled());
    }

    private GreenhouseResponse toResponse(Greenhouse greenhouse) {
        return new GreenhouseResponse(
                greenhouse.getId(),
                greenhouse.getCode(),
                greenhouse.getName(),
                greenhouse.getLocation(),
                greenhouse.getAreaSqm(),
                greenhouse.getCropType(),
                greenhouse.isEnabled(),
                greenhouse.getCreatedAt(),
                greenhouse.getUpdatedAt());
    }

    private DeviceMappingResponse toMappingResponse(DeviceGreenhouseMapping mapping) {
        return new DeviceMappingResponse(
                mapping.getId(),
                mapping.getDeviceId(),
                mapping.getDeviceName(),
                mapping.getDeviceType(),
                mapping.getGreenhouseCode(),
                mapping.getStatus(),
                mapping.getBoundAt(),
                mapping.getUnboundAt(),
                mapping.getUpdatedAt());
    }
}
