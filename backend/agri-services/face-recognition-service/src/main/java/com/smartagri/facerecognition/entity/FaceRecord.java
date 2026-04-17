package com.smartagri.facerecognition.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "face_record")
@Getter
@Setter
@NoArgsConstructor
public class FaceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "person_id", nullable = false, unique = true, length = 64)
    private String personId;

    @Column(name = "person_name", nullable = false, length = 128)
    private String personName;

    /** 人脸特征向量，序列化为字节数组存储 */
    @Lob
    @Column(name = "embedding", nullable = false, columnDefinition = "LONGBLOB")
    private byte[] embedding;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
