package com.smartagri.facerecognition.repository;

import com.smartagri.facerecognition.entity.FaceRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FaceRecordRepository extends JpaRepository<FaceRecord, Long> {

    Optional<FaceRecord> findByPersonId(String personId);

    boolean existsByPersonId(String personId);

    void deleteByPersonId(String personId);
}
