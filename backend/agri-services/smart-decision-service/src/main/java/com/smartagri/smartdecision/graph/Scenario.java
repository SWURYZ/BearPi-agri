package com.smartagri.smartdecision.graph;

/**
 * 8 个智慧农业智能决策场景，每个场景携带领域专用的系统提示词。
 */
public enum Scenario {

    IRRIGATION("灌溉决策",
            "你是智慧农业灌溉决策专家。请根据以下大棚传感器数据分析当前土壤和空气湿度状况，" +
            "判断是否需要进行灌溉操作，给出具体的灌溉建议（包括灌溉时机、时长和水量），并说明决策依据。"),

    LIGHT("补光决策",
            "你是智慧农业补光决策专家。请根据以下大棚传感器数据分析当前光照强度，" +
            "判断是否需要开启或关闭补光灯，给出补光方案建议（包括补光时段和强度），并说明决策依据。"),

    VENTILATION("通风降温决策",
            "你是智慧农业通风决策专家。请根据以下大棚传感器数据分析当前温湿度状况，" +
            "判断是否需要开启通风系统（风扇）进行降温除湿，给出通风方案建议，并说明决策依据。"),

    TEMPERATURE("温度调控决策",
            "你是智慧农业温控决策专家。请根据以下大棚传感器数据分析当前温度趋势，" +
            "判断温度是否在作物适宜范围内，给出温度调控策略（升温或降温），并说明决策依据。"),

    PEST("病虫害预警",
            "你是智慧农业病虫害预警专家。请根据以下大棚环境数据（温度、湿度、光照等），" +
            "评估当前环境是否有利于病虫害滋生，给出病虫害风险等级和预防建议，并说明分析依据。"),

    FERTILIZATION("施肥建议",
            "你是智慧农业施肥决策专家。请根据以下大棚环境数据和作物生长阶段，" +
            "给出科学的施肥建议（包括肥料种类、用量和施肥时机），并说明决策依据。"),

    HARVEST("采收时机",
            "你是智慧农业采收决策专家。请根据以下大棚环境数据，结合作物生长周期规律，" +
            "判断当前是否是最佳采收时机，给出采收建议和注意事项，并说明分析依据。"),

    ANOMALY("异常告警",
            "你是智慧农业异常检测专家。请根据以下大棚传感器数据，检测是否存在异常情况" +
            "（如温度过高/过低、湿度异常、光照不足、设备状态异常等），给出告警信息和处理建议。");

    private final String label;
    private final String systemPrompt;

    Scenario(String label, String systemPrompt) {
        this.label = label;
        this.systemPrompt = systemPrompt;
    }

    public String label() {
        return label;
    }

    /**
     * 拼装完整 Prompt = 系统角色 + 传感器上下文 + 用户问题
     */
    public String buildPrompt(String sensorContext, String userQuery) {
        return systemPrompt + "\n\n" + sensorContext +
                "\n\n【用户问题】\n" + userQuery +
                "\n\n请给出你的专业分析和决策建议：";
    }

    /**
     * 从字符串安全解析场景枚举，匹配失败时返回 ANOMALY 兜底
     */
    public static Scenario fromName(String name) {
        if (name == null || name.isBlank()) return ANOMALY;
        String upper = name.trim().toUpperCase();
        for (Scenario s : values()) {
            if (s.name().equals(upper)) return s;
        }
        for (Scenario s : values()) {
            if (name.contains(s.label)) return s;
        }
        return ANOMALY;
    }
}
