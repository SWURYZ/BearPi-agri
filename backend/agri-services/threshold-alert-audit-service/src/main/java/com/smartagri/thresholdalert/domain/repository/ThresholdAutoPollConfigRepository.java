package com.smartagri.thresholdalert.domain.repository;

import com.smartagri.thresholdalert.domain.entity.ThresholdAutoPollConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThresholdAutoPollConfigRepository extends JpaRepository<ThresholdAutoPollConfig, Long> {
}
