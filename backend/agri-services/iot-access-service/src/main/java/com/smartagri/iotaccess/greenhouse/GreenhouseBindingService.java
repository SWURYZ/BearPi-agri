package com.smartagri.iotaccess.greenhouse;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class GreenhouseBindingService {

    private static final Map<String, String> GREENHOUSE_DEVICE_MAP = Map.of(
            "1号大棚", "69d75b1d7f2e6c302f654fea_20031104",
            "GH-01", "69d75b1d7f2e6c302f654fea_20031104"
    );

    public Optional<String> resolveDeviceId(String greenhouse) {
        return Optional.ofNullable(GREENHOUSE_DEVICE_MAP.get(greenhouse));
    }
}
