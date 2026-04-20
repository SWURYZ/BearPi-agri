package com.smartagri.facerecognition.repository;

import com.smartagri.facerecognition.entity.LoginLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LoginLogRepository extends JpaRepository<LoginLog, Long> {
    List<LoginLog> findAllByOrderByLoginTimeDesc();
}
