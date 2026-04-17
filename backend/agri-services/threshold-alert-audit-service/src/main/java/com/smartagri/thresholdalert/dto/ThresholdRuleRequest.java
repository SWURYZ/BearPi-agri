package com.smartagri.thresholdalert.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ThresholdRuleRequest(
        @NotBlank String deviceId,
        @NotNull BigDecimal temperatureMin,
        @NotNull BigDecimal temperatureMax,
        @NotNull BigDecimal humidityMin,
        @NotNull BigDecimal humidityMax,
    BigDecimal lightMin,
    BigDecimal lightMax,
    BigDecimal co2Min,
    BigDecimal co2Max,
    BigDecimal soilHumidityMin,
    BigDecimal soilHumidityMax,
    BigDecimal soilTemperatureMin,
    BigDecimal soilTemperatureMax,
        Boolean enabled
) {

    @AssertTrue(message = "温度上限必须大于等于温度下限")
    public boolean isTemperatureRangeValid() {
        if (temperatureMin == null || temperatureMax == null) {
            return true;
        }
        return temperatureMax.compareTo(temperatureMin) >= 0;
    }

    @AssertTrue(message = "湿度上限必须大于等于湿度下限")
    public boolean isHumidityRangeValid() {
        if (humidityMin == null || humidityMax == null) {
            return true;
        }
        return humidityMax.compareTo(humidityMin) >= 0;
    }

    @AssertTrue(message = "光照上限必须大于等于光照下限")
    public boolean isLightRangeValid() {
        if (lightMin == null || lightMax == null) {
            return true;
        }
        return lightMax.compareTo(lightMin) >= 0;
    }

    @AssertTrue(message = "CO2上限必须大于等于CO2下限")
    public boolean isCo2RangeValid() {
        if (co2Min == null || co2Max == null) {
            return true;
        }
        return co2Max.compareTo(co2Min) >= 0;
    }

    @AssertTrue(message = "土壤湿度上限必须大于等于土壤湿度下限")
    public boolean isSoilHumidityRangeValid() {
        if (soilHumidityMin == null || soilHumidityMax == null) {
            return true;
        }
        return soilHumidityMax.compareTo(soilHumidityMin) >= 0;
    }

    @AssertTrue(message = "土壤温度上限必须大于等于土壤温度下限")
    public boolean isSoilTemperatureRangeValid() {
        if (soilTemperatureMin == null || soilTemperatureMax == null) {
            return true;
        }
        return soilTemperatureMax.compareTo(soilTemperatureMin) >= 0;
    }
}
