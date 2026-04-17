package com.smartagri.thresholdalert.service;

import com.smartagri.thresholdalert.domain.entity.ThresholdAutoPollConfig;
import com.smartagri.thresholdalert.domain.repository.ThresholdAutoPollConfigRepository;
import com.smartagri.thresholdalert.dto.ThresholdAutoPollConfigRequest;
import com.smartagri.thresholdalert.dto.ThresholdAutoPollConfigResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ThresholdAutoPollConfigService {

    private final ThresholdAutoPollConfigRepository configRepository;

    @Value("${threshold-alert.auto-poll.default-interval-minutes:2}")
    private int defaultIntervalMinutes;

    @Transactional
    public ThresholdAutoPollConfigResponse getConfig() {
        ThresholdAutoPollConfig config = getOrCreate();
        return toResponse(config);
    }

    @Transactional
    public ThresholdAutoPollConfigResponse updateConfig(ThresholdAutoPollConfigRequest request) {
        ThresholdAutoPollConfig config = getOrCreate();
        config.setPollIntervalMinutes(request.pollIntervalMinutes());
        configRepository.save(config);
        return toResponse(config);
    }

    @Transactional
    public int resolveIntervalMinutes() {
        ThresholdAutoPollConfig config = getOrCreate();
        return config.getPollIntervalMinutes();
    }

    private ThresholdAutoPollConfig getOrCreate() {
        return configRepository.findById(ThresholdAutoPollConfig.SINGLETON_ID)
                .orElseGet(() -> {
                    ThresholdAutoPollConfig created = new ThresholdAutoPollConfig();
                    created.setId(ThresholdAutoPollConfig.SINGLETON_ID);
                    created.setPollIntervalMinutes(Math.max(1, defaultIntervalMinutes));
                    return configRepository.save(created);
                });
    }

    private ThresholdAutoPollConfigResponse toResponse(ThresholdAutoPollConfig config) {
        return new ThresholdAutoPollConfigResponse(config.getPollIntervalMinutes());
    }
}
