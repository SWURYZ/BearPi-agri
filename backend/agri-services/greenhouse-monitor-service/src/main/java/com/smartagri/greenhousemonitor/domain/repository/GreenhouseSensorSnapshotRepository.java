package com.smartagri.greenhousemonitor.domain.repository;

import com.smartagri.greenhousemonitor.domain.entity.GreenhouseSensorSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GreenhouseSensorSnapshotRepository extends JpaRepository<GreenhouseSensorSnapshot, String> {

    List<GreenhouseSensorSnapshot> findByGreenhouseCode(String greenhouseCode);
}
