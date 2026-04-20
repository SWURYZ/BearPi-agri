package com.smartagri.facerecognition.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {
    private Long id;
    private String username;
    private String displayName;
    private String role;
    private String registeredBy;
    private boolean faceRegistered;
    private String facePersonId;
    private String createdAt;
}
