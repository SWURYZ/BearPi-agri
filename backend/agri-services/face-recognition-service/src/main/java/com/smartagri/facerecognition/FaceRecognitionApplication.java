package com.smartagri.facerecognition;

import com.smartagri.facerecognition.config.FaceRecognitionProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(FaceRecognitionProperties.class)
public class FaceRecognitionApplication {

    public static void main(String[] args) {
        SpringApplication.run(FaceRecognitionApplication.class, args);
    }
}
