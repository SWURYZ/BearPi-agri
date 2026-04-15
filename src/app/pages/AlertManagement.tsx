import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Download,
  Check,
  X,
  Plus,
  Thermometer,
  Droplets,
  Settings,
  Clock,
} from "lucide-react";
import { SimpleModal } from "../components/ui/SimpleModal";

const alertRecords = [
  { id: "ALT-001", gh: "2号大棚", deviceId: "DEV-GH02-T01", type: "温度过高", sensor: "空气温度", value: 32.1, threshold: 30, unit: "°C", time: "2026-04-14 14:28:32", status: "未处理", level: "高" },
  { id: "ALT-002", gh: "2号大棚", deviceId: "DEV-GH02-H01", type: "湿度过高", sensor: "空气湿度", value: 85, threshold: 80, unit: "%", time: "2026-04-14 14:25:10", status: "未处理", level: "高" },
  { id: "ALT-003", gh: "6号大棚", deviceId: "DEV-GH06-L01", type: "光照过强", sensor: "光照强度", value: 11200, threshold: 10000, unit: "lux", time: "2026-04-14 13:50:05", status: "已确认", level: "中" },
  { id: "ALT-004", gh: "1号大棚", deviceId: "DEV-GH01-C01", type: "CO₂浓度高", sensor: "CO₂浓度", value: 620, threshold: 600, unit: "ppm", time: "2026-04-14 11:20:44", status: "已处理", level: "低" },
  { id: "ALT-005", gh: "3号大棚", deviceId: "DEV-GH03-T01", type: "温度偏低", sensor: "空气温度", value: 14.2, threshold: 15, unit: "°C", time: "2026-04-14 09:15:22", status: "已处理", level: "中" },
  { id: "ALT-006", gh: "5号大棚", deviceId: "DEV-GH05-H01", type: "湿度偏低", sensor: "土壤湿度", value: 25, threshold: 30, unit: "%", time: "2026-04-13 22:30:18", status: "已处理", level: "低" },
];

const thresholdSettings = [
  { sensor: "空气温度", min: 18, max: 30, unit: "°C", icon: Thermometer, color: "orange" },
  { sensor: "空气湿度", min: 50, max: 80, unit: "%", icon: Droplets, color: "blue" },
  { sensor: "土壤温度", min: 15, max: 28, unit: "°C", icon: Thermometer, color: "red" },
  { sensor: "土壤湿度", min: 30, max: 70, unit: "%", icon: Droplets, color: "cyan" },
  { sensor: "光照强度", min: 2000, max: 10000, unit: "lux", icon: Settings, color: "yellow" },
  { sensor: "CO₂浓度", min: 350, max: 600, unit: "ppm", icon: Settings, color: "green" },
];

const levelColors: Record<string, string> = {
  高: "bg-red-100 text-red-600",
  中: "bg-yellow-100 text-yellow-600",
  低: "bg-blue-100 text-blue-600",
};

const statusColors: Record<string, string> = {
  未处理: "bg-red-50 text-red-600 border-red-200",
  已确认: "bg-yellow-50 text-yellow-600 border-yellow-200",
  已处理: "bg-green-50 text-green-600 border-green-200",
};

function nowStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}_${hh}${mm}${ss}`;
}

export function AlertManagement() {
  const [activeTab, setActiveTab] = useState<"records" | "settings">("records");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [filterGH, setFilterGH] = useState("全部");
  const [thresholds, setThresholds] = useState(thresholdSettings);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ sensor: "", min: 0, max: 0 });
  const [pendingOverwrite, setPendingOverwrite] = useState<{
    index: number;
    sensor: string;
    min: number;
    max: number;
  } | null>(null);

  const filtered = alertRecords.filter((r) => {
    if (filterStatus !== "全部" && r.status !== filterStatus) return false;
    if (filterGH !== "全部" && r.gh !== filterGH) return false;
    return true;
  });

  const unhandled = alertRecords.filter((r) => r.status === "未处理").length;

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 2600);
  }

  function updateThresholdValue(idx: number, key: "min" | "max", value: number) {
    const next = [...thresholds];
    next[idx] = { ...next[idx], [key]: value };
    setThresholds(next);
  }

  function saveThresholdRule(idx: number) {
    const item = thresholds[idx];
    if (item.max <= item.min) {
      showMessage("error", `${item.sensor} 配置失败：上限值必须大于下限值`);
      return;
    }
    showMessage("success", `${item.sensor} 阈值保存成功`);
  }

  function exportRecords() {
    if (filtered.length === 0) {
      showMessage("error", "告警记录为空，导出失败");
      return;
    }

    const headers = ["告警ID", "大棚", "设备ID", "告警类型", "传感器", "当前值", "阈值", "单位", "时间", "级别", "状态"];
    const rows = filtered.map((r) => [
      r.id,
      r.gh,
      r.deviceId,
      r.type,
      r.sensor,
      String(r.value),
      String(r.threshold),
      r.unit,
      r.time,
      r.level,
      r.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const filename = `alert_records_${nowStamp()}.csv`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage("success", `导出成功，文件已保存到默认下载目录：${filename}`);
  }

  function handleAddRule() {
    const sensor = newRule.sensor.trim();
    if (!sensor) {
      showMessage("error", "参数名不能为空");
      return;
    }
    if (newRule.max <= newRule.min) {
      showMessage("error", "新增规则失败：上限值必须大于下限值");
      return;
    }

    const idx = thresholds.findIndex((t) => t.sensor === sensor);
    if (idx >= 0) {
      setPendingOverwrite({ index: idx, sensor, min: newRule.min, max: newRule.max });
      return;
    }

    setThresholds((prev) => [
      ...prev,
      {
        sensor,
        min: newRule.min,
        max: newRule.max,
        unit: "",
        icon: Settings,
        color: "green",
      },
    ]);
    setShowAddRule(false);
    setNewRule({ sensor: "", min: 0, max: 0 });
    showMessage("success", `参数 ${sensor} 新增成功`);
  }

  function confirmOverwrite() {
    if (!pendingOverwrite) {
      return;
    }

    const next = [...thresholds];
    next[pendingOverwrite.index] = {
      ...next[pendingOverwrite.index],
      min: pendingOverwrite.min,
      max: pendingOverwrite.max,
    };
    setThresholds(next);
    setShowAddRule(false);
    setNewRule({ sensor: "", min: 0, max: 0 });
    showMessage("success", `参数 ${pendingOverwrite.sensor} 已覆盖并保存成功`);
    setPendingOverwrite(null);
  }

  function cancelOverwrite() {
    setPendingOverwrite(null);
    showMessage("error", "已取消覆盖");
  }

  return (
    <div className="p-6 space-y-5">
      <SimpleModal
        open={Boolean(pendingOverwrite)}
        title="参数已存在"
        description={pendingOverwrite ? `参数 ${pendingOverwrite.sensor} 已存在，是否覆盖原有阈值？` : ""}
        confirmText="覆盖"
        cancelText="取消"
        onConfirm={confirmOverwrite}
        onCancel={cancelOverwrite}
      />

      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-lg border ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            温湿度阈值告警与审计
            {unhandled > 0 && (
              <span className="flex items-center gap-1 text-sm bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full">
                <Bell className="w-3.5 h-3.5" />
                {unhandled} 条未处理
              </span>
            )}
          </h1>
          
        </div>
        <button
          onClick={exportRecords}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          导出告警记录
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("records")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "records" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          告警记录
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "settings" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          阈值配置
        </button>
      </div>

      {activeTab === "records" && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "今日告警", value: 6, color: "gray" },
              { label: "未处理", value: 2, color: "red" },
              { label: "已确认", value: 1, color: "yellow" },
              { label: "已处理", value: 3, color: "green" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
                <div className={`text-2xl font-bold ${
                  s.color === "red" ? "text-red-500" :
                  s.color === "yellow" ? "text-yellow-500" :
                  s.color === "green" ? "text-green-500" :
                  "text-gray-700"
                }`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">状态：</span>
                {["全部", "未处理", "已确认", "已处理"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      filterStatus === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">大棚：</span>
                {["全部", "1号大棚", "2号大棚", "3号大棚", "5号大棚", "6号大棚"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setFilterGH(g)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      filterGH === g ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Alert Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["告警ID", "大棚", "设备ID", "告警类型", "当前值/阈值", "时间", "级别", "状态", "操作"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{record.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{record.gh}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{record.deviceId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 ${
                          record.level === "高" ? "text-red-500" : record.level === "中" ? "text-yellow-500" : "text-blue-500"
                        }`} />
                        <span className="text-sm text-gray-700">{record.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-red-500">{record.value}{record.unit}</span>
                      <span className="text-xs text-gray-400 ml-1">/ 阈值{record.threshold}{record.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {record.time}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[record.level]}`}>
                        {record.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${statusColors[record.status]}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {record.status === "未处理" && (
                          <button className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors" title="确认">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className="p-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors" title="忽略">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无符合条件的告警记录</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">为每种传感器配置告警阈值上下限，超出范围时系统自动预警</p>
            <button
              onClick={() => setShowAddRule(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              添加规则
            </button>
          </div>

          {showAddRule && (
            <div className="bg-white rounded-xl border-2 border-green-300 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">新增阈值规则</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">参数名</label>
                  <input
                    value={newRule.sensor}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, sensor: e.target.value }))}
                    placeholder="如：叶面湿度"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">下限值</label>
                  <input
                    type="number"
                    value={newRule.min}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, min: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">上限值</label>
                  <input
                    type="number"
                    value={newRule.max}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, max: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                </div>
              </div>
              {newRule.max <= newRule.min && (
                <p className="text-xs text-red-500 mt-2">校验失败：上限值必须大于下限值</p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowAddRule(false);
                    setNewRule({ sensor: "", min: 0, max: 0 });
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleAddRule}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  保存
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {thresholds.map((t, idx) => (
              <div key={t.sensor} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-xl ${
                    t.color === "orange" ? "bg-orange-50" :
                    t.color === "blue" ? "bg-blue-50" :
                    t.color === "red" ? "bg-red-50" :
                    t.color === "cyan" ? "bg-cyan-50" :
                    t.color === "yellow" ? "bg-yellow-50" :
                    "bg-green-50"
                  }`}>
                    <t.icon className={`w-5 h-5 ${
                      t.color === "orange" ? "text-orange-500" :
                      t.color === "blue" ? "text-blue-500" :
                      t.color === "red" ? "text-red-500" :
                      t.color === "cyan" ? "text-cyan-500" :
                      t.color === "yellow" ? "text-yellow-500" :
                      "text-green-500"
                    }`} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">{t.sensor}</h3>
                  <span className="ml-auto text-xs text-gray-400">{t.unit}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">下限（最低值）</label>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <input
                        type="number"
                        value={t.min}
                        onChange={(e) => updateThresholdValue(idx, "min", Number(e.target.value))}
                        className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none bg-transparent"
                      />
                      <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 py-2">{t.unit}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">上限（最高值）</label>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <input
                        type="number"
                        value={t.max}
                        onChange={(e) => updateThresholdValue(idx, "max", Number(e.target.value))}
                        className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none bg-transparent"
                      />
                      <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 py-2">{t.unit}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400">当前范围：{t.min} - {t.max} {t.unit}</span>
                  {t.max <= t.min && (
                    <span className="text-xs text-red-500">上限值必须大于下限值</span>
                  )}
                  <button
                    onClick={() => saveThresholdRule(idx)}
                    className="ml-auto px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
