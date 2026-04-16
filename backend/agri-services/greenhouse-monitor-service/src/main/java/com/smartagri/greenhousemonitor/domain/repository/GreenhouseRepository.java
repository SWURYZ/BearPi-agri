package com.smartagri.greenhousemonitor.domain.repository;

import com.smartagri.greenhousemonitor.domain.entity.Greenhouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GreenhouseRepository extends JpaRepository<Greenhouse, Long> {

    Optional<Greenhouse> findByCode(String code);

    List<Greenhouse> findByEnabled(boolean enabled);
}
