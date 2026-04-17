package com.smartagri.facerecognition.repository;

import com.smartagri.facerecognition.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByUsername(String username);

    Optional<AppUser> findByFacePersonId(String facePersonId);

    boolean existsByUsername(String username);
}
