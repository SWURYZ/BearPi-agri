package com.smartagri.historicalanalysis.service;

import com.smartagri.historicalanalysis.config.HistoricalAnalysisProperties;
import com.smartagri.historicalanalysis.domain.entity.DeviceTelemetry;
import com.smartagri.historicalanalysis.domain.repository.DeviceTelemetryRepository;
import com.smartagri.historicalanalysis.dto.RealtimeMetricsResponse;
import com.smartagri.historicalanalysis.dto.SensorHistoryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GreenhouseHistoricalService {

    private static final DateTimeFormatter TIME_24H_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter TIME_MULTI_DAY_FORMATTER = DateTimeFormatter.ofPattern("MM/dd HH:mm");

    private final DeviceTelemetryRepository telemetryRepository;
    private final HistoricalAnalysisProperties properties;

    public Optional<String> resolveDeviceId(String greenhouse) {
        if (!StringUtils.hasText(greenhouse)) {
            return Optional.empty();
        }

        String normalized = normalizeGreenhouseName(greenhouse);
        String deviceId = properties.getGreenhouseDeviceMap().get(greenhouse);
        if (!StringUtils.hasText(deviceId)) {
            deviceId = properties.getGreenhouseDeviceMap().get(normalized);
        }

        // Fallback aliases to keep frontend default option (1号大棚) always available.
        if (!StringUtils.hasText(deviceId)) {
            if ("1号大棚".equals(normalized) || "gh-01".equalsIgnoreCase(normalized) || "1".equals(normalized)) {
                deviceId = "69d75b1d7f2e6c302f654fea_20031104";
            }
        }

        return Optional.ofNullable(deviceId);
    }

    private String normalizeGreenhouseName(String greenhouse) {
        if (greenhouse == null) {
            return "";
        }
        return greenhouse
                .replace(" ", "")
                .replace("　", "")
                .trim();
    }

    public RealtimeMetricsResponse realtime(String greenhouse, String deviceId) {
        DeviceTelemetry latest = telemetryRepository.findFirstByDeviceIdOrderByReportTimeDesc(deviceId);
        if (latest == null) {
            return null;
        }

        return new RealtimeMetricsResponse(
                greenhouse,
                deviceId,
                latest.getTemperature(),
                latest.getHumidity(),
                latest.getLuminance(),
                latest.getReportTime()
        );
    }

    public List<SensorHistoryPoint> history(String deviceId, String sensor, String range, boolean aggregate, boolean fixedSlots) {
        int minutes = parseRangeToMinutes(range);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime after = now.minusMinutes(minutes);
        List<DeviceTelemetry> source = telemetryRepository.findByDeviceIdAndReportTimeAfterOrderByReportTimeAsc(deviceId, after);

        if (source.isEmpty()) {
            return List.of();
        }

        DateTimeFormatter formatter = minutes <= 24 * 60 ? TIME_24H_FORMATTER : TIME_MULTI_DAY_FORMATTER;
        if (!aggregate) {
            List<SensorHistoryPoint> rawPoints = new ArrayList<>();
            for (DeviceTelemetry telemetry : source) {
                Double value = selectSensorValue(sensor, telemetry);
                if (value == null) {
                    continue;
                }
                LocalDateTime pointTime = telemetry.getReportTime();
                rawPoints.add(new SensorHistoryPoint(
                        pointTime.format(formatter),
                        pointTime,
                        value
                ));
            }
            return rawPoints;
        }

        LocalDateTime alignedEnd = alignToHalfHour(now);
        int slotCount = Math.max(1, minutes / 30);
        LocalDateTime alignedStart = fixedSlots
            ? alignedEnd.minusMinutes((long) (slotCount - 1) * 30)
            : alignToHalfHour(after);

        Map<LocalDateTime, List<Double>> bucketValues = new HashMap<>();
        for (DeviceTelemetry telemetry : source) {
            Double value = selectSensorValue(sensor, telemetry);
            if (value == null) {
                continue;
            }
            LocalDateTime bucketTime = alignToHalfHour(telemetry.getReportTime());
            bucketValues.computeIfAbsent(bucketTime, k -> new ArrayList<>()).add(value);
        }

        List<SensorHistoryPoint> points = new ArrayList<>();
        List<Double> rawSeries = new ArrayList<>();
        List<LocalDateTime> timeline = new ArrayList<>();

        if (fixedSlots) {
            LocalDateTime cursor = alignedStart;
            for (int i = 0; i < slotCount; i++) {
                timeline.add(cursor);
                List<Double> values = bucketValues.get(cursor);
                if (values == null || values.isEmpty()) {
                    rawSeries.add(null);
                } else {
                    double sum = 0.0;
                    for (Double val : values) {
                        sum += val;
                    }
                    rawSeries.add(sum / values.size());
                }
                cursor = cursor.plusMinutes(30);
            }
        } else {
            LocalDateTime cursor = alignedStart;
            while (!cursor.isAfter(alignedEnd)) {
                timeline.add(cursor);
                List<Double> values = bucketValues.get(cursor);
                if (values == null || values.isEmpty()) {
                    rawSeries.add(null);
                } else {
                    double sum = 0.0;
                    for (Double val : values) {
                        sum += val;
                    }
                    rawSeries.add(sum / values.size());
                }
                cursor = cursor.plusMinutes(30);
            }
        }

        // Forward fill then backward fill to keep the timeline continuous.
        for (int i = 1; i < rawSeries.size(); i++) {
            if (rawSeries.get(i) == null) {
                rawSeries.set(i, rawSeries.get(i - 1));
            }
        }
        for (int i = rawSeries.size() - 2; i >= 0; i--) {
            if (rawSeries.get(i) == null) {
                rawSeries.set(i, rawSeries.get(i + 1));
            }
        }

        for (int i = 0; i < timeline.size(); i++) {
            Double value = rawSeries.get(i);
            if (value == null) {
                continue;
            }
            LocalDateTime pointTime = timeline.get(i);
            points.add(new SensorHistoryPoint(
                    pointTime.format(formatter),
                    pointTime,
                    value
            ));
        }

        if (fixedSlots) {
            return points;
        }
        return downSample(points, properties.getMaxPoints());
    }

    private int parseRangeToMinutes(String range) {
        if (!StringUtils.hasText(range)) {
            return 24 * 60;
        }

        String normalized = range.trim().toLowerCase();
        if (normalized.endsWith("h")) {
            Integer hours = parsePositiveInt(normalized.substring(0, normalized.length() - 1));
            if (hours != null) {
                return hours * 60;
            }
        }
        if (normalized.endsWith("d")) {
            Integer days = parsePositiveInt(normalized.substring(0, normalized.length() - 1));
            if (days != null) {
                return days * 24 * 60;
            }
        }

        return switch (normalized) {
            case "today", "24h" -> 24 * 60;
            case "3d", "72h" -> 72 * 60;
            case "7d", "168h" -> 168 * 60;
            case "30d", "720h" -> 720 * 60;
            default -> 24 * 60;
        };
    }

    private Integer parsePositiveInt(String value) {
        try {
            int parsed = Integer.parseInt(value);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Double selectSensorValue(String sensor, DeviceTelemetry telemetry) {
        return switch (sensor) {
            case "temp" -> telemetry.getTemperature();
            case "humidity" -> telemetry.getHumidity();
            case "light" -> telemetry.getLuminance();
            default -> null;
        };
    }

    private LocalDateTime alignToHalfHour(LocalDateTime time) {
        int minute = time.getMinute();
        int alignedMinute = minute < 30 ? 0 : 30;
        return time.withMinute(alignedMinute).withSecond(0).withNano(0);
    }

    private List<SensorHistoryPoint> downSample(List<SensorHistoryPoint> source, int maxPoints) {
        if (source.size() <= maxPoints || maxPoints <= 0) {
            return source;
        }

        List<SensorHistoryPoint> result = new ArrayList<>(maxPoints);
        double step = (double) (source.size() - 1) / (double) (maxPoints - 1);
        for (int i = 0; i < maxPoints; i++) {
            int index = (int) Math.round(i * step);
            if (index >= source.size()) {
                index = source.size() - 1;
            }
            result.add(source.get(index));
        }
        return result;
    }
}
