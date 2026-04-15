package com.smartagri.api.smoke.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record SmokeCheckResponse(
        String service,
        String environment,
        OffsetDateTime checkedAt,
        List<ComponentCheck> checks
) {
}
