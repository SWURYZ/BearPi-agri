package com.smartagri.compositecondition.domain.repository;

import com.smartagri.compositecondition.domain.entity.CompositeRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompositeRuleRepository extends JpaRepository<CompositeRule, Long> {

    List<CompositeRule> findByEnabled(boolean enabled);

    boolean existsByIdAndEnabledTrue(Long id);
}
