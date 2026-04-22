import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Clock,
  Download,
  Plus,
  Power,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { SimpleModal } from "../components/ui/SimpleModal";
import {
  createThresholdRule,
  deleteThresholdRule,
  fetchThresholdAlertRecords,
  fetchThresholdRules,
  runThresholdCheckNow,
  ThresholdAlertRecord,
  ThresholdRule,
  toggleThresholdRule,
  updateThresholdRule,
} from "../services/thresholdAlert";

type TabType = "records" | "settings";

type RuleDraft = {
  key: string;
  greenhouseNo: string;
  metric: string;
  minThreshold: number;
  maxThreshold: number;
  enabled: boolean;
};

type RangeRule = {
  key: string;
  greenhouseNo: string;
  metric: string;
  minRuleId?: number;
  maxRuleId?: number;
  minThreshold: number;
  maxThreshold: number;
  enabled: boolean;
};

type OverwriteState =
  | {
      mode: "create";
      draft: RuleDraft;
      target: RangeRule;
    }
  | {
      mode: "save";
      sourceKey: string;
      draft: RuleDraft;
      target: RangeRule;
    };

const greenhouseOptions = [
  { value: "1", label: "1号大棚" },
  { value: "2", label: "2号大棚" },
  { value: "3", label: "3号大棚" },
  { value: "4", label: "4号大棚" },
  { value: "5", label: "5号大棚" },
  { value: "6", label: "6号大棚" },
];

const metricOptions = [
  { key: "temp", label: "空气温度", unit: "°C" },
  { key: "humidity", label: "空气湿度", unit: "%" },
  { key: "light", label: "光照强度", unit: "lux" },
  { key: "co2", label: "二氧化碳浓度", unit: "ppm" },
];

const metricPlaceholders: Record<string, { min: string; max: string; hint: string }> = {
  temp: { min: "例如 18", max: "例如 30", hint: "建议温度区间：18 - 30 °C" },
  humidity: { min: "例如 50", max: "例如 80", hint: "建议湿度区间：50 - 80 %" },
  light: { min: "例如 2000", max: "例如 10000", hint: "建议光照区间：2000 - 10000 lux" },
  co2: { min: "例如 350", max: "例如 600", hint: "建议CO2区间：350 - 600 ppm" },
};

function metricLabel(metric: string) {
  const item = metricOptions.find((m) => m.key === metric);
  return item ? item.label : metric;
}

function metricUnit(metric: string) {
  const item = metricOptions.find((m) => m.key === metric);
  return item ? item.unit : "";
}

function greenhouseLabel(greenhouseNo: string) {
  const item = greenhouseOptions.find((g) => g.value === greenhouseNo);
  return item ? item.label : `${greenhouseNo}号大棚`;
}

function inferGreenhouseNo(deviceId: string) {
  const match = /GH(\d{1,2})/i.exec(deviceId);
  if (!match) {
    return "1";
  }
  return String(parseInt(match[1], 10));
}

function resolveDeviceId(greenhouseNo: string, metric: string) {
  const suffixByMetric: Record<string, string> = {
    temp: "T01",
    humidity: "H01",
    light: "L01",
    co2: "C01",
  };
  const suffix = suffixByMetric[metric] ?? "T01";
  const no = greenhouseNo.padStart(2, "0");
  return `DEV-GH${no}-${suffix}`;
}

function metricTheme(metric: string) {
  switch (metric) {
    case "temp":
      return { chip: "bg-orange-50 text-orange-600", bar: "bg-orange-500" };
    case "humidity":
      return { chip: "bg-blue-50 text-blue-600", bar: "bg-blue-500" };
    case "light":
      return { chip: "bg-yellow-50 text-yellow-700", bar: "bg-yellow-500" };
    case "co2":
      return { chip: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" };
    default:
      return { chip: "bg-gray-50 text-gray-600", bar: "bg-gray-500" };
  }
}

function toRangeRules(ruleData: ThresholdRule[]): RangeRule[] {
  const grouped = new Map<string, RangeRule>();

  for (const rule of ruleData) {
    const greenhouseNo = inferGreenhouseNo(rule.deviceId);
    const key = `${greenhouseNo}|${rule.metric}`;
    const current = grouped.get(key) ?? {
      key,
      greenhouseNo,
      metric: rule.metric,
      minThreshold: 0,
      maxThreshold: 0,
      enabled: false,
    };

    if (rule.operator === "BELOW") {
      current.minRuleId = rule.id;
      current.minThreshold = rule.threshold;
    }
    if (rule.operator === "ABOVE") {
      current.maxRuleId = rule.id;
      current.maxThreshold = rule.threshold;
    }
    current.enabled = current.enabled || rule.enabled;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => {
      if (item.minThreshold <= 0 && item.maxThreshold > 0) {
        item.minThreshold = Math.max(0, Number((item.maxThreshold * 0.8).toFixed(2)));
      }
      if (item.maxThreshold <= 0 && item.minThreshold > 0) {
        item.maxThreshold = Number((item.minThreshold * 1.2).toFixed(2));
      }
      return item;
    })
    .sort((a, b) => {
      const ga = parseInt(a.greenhouseNo, 10);
      const gb = parseInt(b.greenhouseNo, 10);
      if (ga !== gb) {
        return ga - gb;
      }
      return a.metric.localeCompare(b.metric);
    });
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

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
  const [activeTab, setActiveTab] = useState<TabType>("records");
  const [rules, setRules] = useState<RangeRule[]>([]);
  const [records, setRecords] = useState<ThresholdAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRule, setShowAddRule] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<OverwriteState | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});
  const [newRule, setNewRule] = useState<RuleDraft>({
    key: "new",
    greenhouseNo: "2",
    metric: "temp",
    minThreshold: 18,
    maxThreshold: 30,
    enabled: true,
  });

  async function loadAll() {
    const [ruleData, recordData] = await Promise.all([
      fetchThresholdRules(),
      fetchThresholdAlertRecords(),
    ]);
    const rangeRules = toRangeRules(ruleData);
    setRules(rangeRules);
    setRecords(recordData);

    const nextDrafts: Record<string, RuleDraft> = {};
    rangeRules.forEach((r) => {
      nextDrafts[r.key] = {
        key: r.key,
        greenhouseNo: r.greenhouseNo,
        metric: r.metric,
        minThreshold: r.minThreshold,
        maxThreshold: r.maxThreshold,
        enabled: r.enabled,
      };
    });
    setDrafts(nextDrafts);
  }

  useEffect(() => {
    let stopped = false;

    async function bootstrap() {
      try {
        await loadAll();
      } catch (err) {
        if (!stopped) {
          const msg = err instanceof Error ? err.message : "阈值告警数据加载失败。";
          showMessage("error", msg);
        }
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    const timer = window.setInterval(async () => {
      if (stopped) {
        return;
      }
      try {
        const data = await fetchThresholdAlertRecords();
        setRecords(data);
      } catch {
        // Keep silent in background polling.
      }
    }, 5000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 2600);
  }

  function findDuplicateRule(greenhouseNo: string, metric: string, excludeKey?: string) {
    return rules.find(
      (r) => r.greenhouseNo === greenhouseNo && r.metric === metric && r.key !== excludeKey
    );
  }

  async function deleteRangeRule(rule: RangeRule) {
    const tasks: Promise<void>[] = [];
    if (rule.minRuleId) {
      tasks.push(deleteThresholdRule(rule.minRuleId));
    }
    if (rule.maxRuleId) {
      tasks.push(deleteThresholdRule(rule.maxRuleId));
    }
    await Promise.all(tasks);
  }

  async function saveRangeByDraft(draft: RuleDraft, current?: RangeRule) {
    const deviceId = resolveDeviceId(draft.greenhouseNo, draft.metric);

    if (current?.minRuleId) {
      await updateThresholdRule(current.minRuleId, {
        deviceId,
        metric: draft.metric,
        operator: "BELOW",
        threshold: draft.minThreshold,
        enabled: draft.enabled,
      });
    } else {
      await createThresholdRule({
        deviceId,
        metric: draft.metric,
        operator: "BELOW",
        threshold: draft.minThreshold,
        enabled: draft.enabled,
      });
    }

    if (current?.maxRuleId) {
      await updateThresholdRule(current.maxRuleId, {
        deviceId,
        metric: draft.metric,
        operator: "ABOVE",
        threshold: draft.maxThreshold,
        enabled: draft.enabled,
      });
    } else {
      await createThresholdRule({
        deviceId,
        metric: draft.metric,
        operator: "ABOVE",
        threshold: draft.maxThreshold,
        enabled: draft.enabled,
      });
    }
  }

  async function confirmOverwriteRule() {
    if (!pendingOverwrite) {
      return;
    }

    try {
      await deleteRangeRule(pendingOverwrite.target);

      if (pendingOverwrite.mode === "create") {
        await saveRangeByDraft(pendingOverwrite.draft);
      } else {
        const source = rules.find((r) => r.key === pendingOverwrite.sourceKey);
        if (!source) {
          showMessage("error", "原规则不存在，请刷新后重试。");
          setPendingOverwrite(null);
          return;
        }
        await saveRangeByDraft(pendingOverwrite.draft, source);
      }

      await loadAll();
      showMessage("success", "已覆盖重复规则并保存。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "覆盖规则失败。";
      showMessage("error", msg);
    } finally {
      setPendingOverwrite(null);
    }
  }

  async function handleCheckNow() {
    try {
      await runThresholdCheckNow();
      const data = await fetchThresholdAlertRecords();
      setRecords(data);
      showMessage("success", "已执行阈值检测。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "执行阈值检测失败。";
      showMessage("error", msg);
    }
  }

  async function handleCreateRule() {
    if (newRule.maxThreshold <= newRule.minThreshold) {
      showMessage("error", "区间无效：上限必须大于下限。");
      return;
    }
    if (newRule.minThreshold < 0 || newRule.maxThreshold <= 0) {
      showMessage("error", "阈值范围不合法。");
      return;
    }

    const duplicate = findDuplicateRule(newRule.greenhouseNo, newRule.metric);
    if (duplicate) {
      setPendingOverwrite({
        mode: "create",
        draft: { ...newRule },
        target: duplicate,
      });
      return;
    }

    try {
      await saveRangeByDraft(newRule);
      await loadAll();
      setShowAddRule(false);
      showMessage("success", "区间规则已创建。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建规则失败。";
      showMessage("error", msg);
    }
  }

  async function handleSaveRule(key: string) {
    const draft = drafts[key];
    const current = rules.find((r) => r.key === key);
    if (!draft) {
      return;
    }
    if (!current) {
      showMessage("error", "规则不存在。请刷新后重试。");
      return;
    }
    if (draft.maxThreshold <= draft.minThreshold) {
      showMessage("error", "区间无效：上限必须大于下限。");
      return;
    }
    if (draft.minThreshold < 0 || draft.maxThreshold <= 0) {
      showMessage("error", "阈值范围不合法。");
      return;
    }

    const duplicate = findDuplicateRule(draft.greenhouseNo, draft.metric, key);
    if (duplicate) {
      setPendingOverwrite({
        mode: "save",
        sourceKey: key,
        draft: { ...draft },
        target: duplicate,
      });
      return;
    }

    try {
      await saveRangeByDraft(draft, current);

      await loadAll();
      showMessage("success", "规则已保存。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "保存规则失败。";
      showMessage("error", msg);
    }
  }

  async function handleToggleRule(key: string) {
    const row = rules.find((r) => r.key === key);
    if (!row) {
      return;
    }
    const enabled = !row.enabled;
    try {
      const tasks: Promise<void>[] = [];
      if (row.minRuleId) {
        tasks.push(toggleThresholdRule(row.minRuleId, enabled));
      }
      if (row.maxRuleId) {
        tasks.push(toggleThresholdRule(row.maxRuleId, enabled));
      }
      await Promise.all(tasks);
      await loadAll();
      showMessage("success", row.enabled ? "规则已停用。" : "规则已启用。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "切换规则状态失败。";
      showMessage("error", msg);
    }
  }

  async function confirmDeleteRule() {
    if (pendingDeleteKey == null) {
      return;
    }
    const row = rules.find((r) => r.key === pendingDeleteKey);
    if (!row) {
      setPendingDeleteKey(null);
      return;
    }

    try {
      const tasks: Promise<void>[] = [];
      if (row.minRuleId) {
        tasks.push(deleteThresholdRule(row.minRuleId));
      }
      if (row.maxRuleId) {
        tasks.push(deleteThresholdRule(row.maxRuleId));
      }
      await Promise.all(tasks);
      await loadAll();
      showMessage("success", "规则已删除。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除规则失败。";
      showMessage("error", msg);
    } finally {
      setPendingDeleteKey(null);
    }
  }

  function updateDraft(id: string, patch: Partial<RuleDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function exportRecords() {
    if (records.length === 0) {
      showMessage("error", "没有可导出的告警记录。");
      return;
    }
    const headers = ["记录ID", "规则ID", "设备ID", "参数", "比较方式", "阈值", "当前值", "告警时间", "告警信息"];
    const rows = records.map((r) => [
      String(r.id),
      String(r.ruleId),
      greenhouseLabel(inferGreenhouseNo(r.deviceId)),
      metricLabel(r.metric),
      r.operator === "ABOVE" ? "超过" : "低于",
      String(r.threshold),
      String(r.currentValue),
      formatTime(r.alertedAt),
      r.message,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const filename = `threshold_alert_records_${nowStamp()}.csv`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage("success", `导出成功：${filename}`);
  }

  const unhandled = records.length;
  const todayCount = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    return records.filter((r) => {
      const t = new Date(r.alertedAt);
      return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    }).length;
  }, [records]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <SimpleModal
        open={pendingDeleteKey != null}
        title="删除规则"
        description="删除后将停止该规则对应的LED闪烁控制。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDeleteRule}
        onCancel={() => setPendingDeleteKey(null)}
      />

      <SimpleModal
        open={pendingOverwrite != null}
        title="发现重复规则"
        description={pendingOverwrite
          ? `${greenhouseLabel(pendingOverwrite.target.greenhouseNo)} - ${metricLabel(
              pendingOverwrite.target.metric
            )} 已存在，是否覆盖原有规则？`
          : ""}
        confirmText="覆盖"
        cancelText="取消"
        onConfirm={confirmOverwriteRule}
        onCancel={() => setPendingOverwrite(null)}
      />

      {message && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${
          message.type === "success"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            阈值告警与审计
            {unhandled > 0 && (
              <span className="flex items-center gap-1 text-sm bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full">
                <Bell className="w-3.5 h-3.5" />
                {unhandled} 条告警
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-400 mt-1">当阈值被触发时，服务会每5秒切换一次LED开关（ON/OFF）实现闪烁。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckNow}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
          >
            <Zap className="w-4 h-4" />
            立即检测
          </button>
          <button
            onClick={exportRecords}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            导出告警
          </button>
        </div>
      </div>

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
          阈值规则
        </button>
      </div>

      {activeTab === "records" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
              <div className="text-2xl font-bold text-gray-700">{todayCount}</div>
              <div className="text-xs text-gray-500 mt-0.5">今日告警</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
              <div className="text-2xl font-bold text-red-500">{records.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">累计告警</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
              <div className="text-2xl font-bold text-green-500">{rules.filter((r) => r.enabled).length}</div>
              <div className="text-xs text-gray-500 mt-0.5">启用规则</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
              <div className="text-2xl font-bold text-gray-700">{rules.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">规则总数</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["记录ID", "规则ID", "设备ID", "参数", "比较", "阈值/当前", "时间", "信息"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{record.id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{record.ruleId}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{record.deviceId}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{metricLabel(record.metric)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{record.operator === "ABOVE" ? "超过" : "低于"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-red-500 font-semibold">{record.currentValue.toFixed(2)}</span>
                      <span className="text-gray-400 ml-1">/ {record.threshold}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(record.alertedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{record.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && records.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无告警记录。</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">阈值区间配置</p>
              <p className="text-xs text-gray-500 mt-1">先选大棚与参数，再设置最小值和最大值，超出区间自动触发告警。</p>
            </div>
            <button
              onClick={() => setShowAddRule(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              添加规则
            </button>
          </div>

          {showAddRule && (
            <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">新建阈值规则</h4>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className="text-xs text-gray-500 mb-1 block">大棚号</label>
                  <select
                    value={newRule.greenhouseNo}
                    onChange={(e) => setNewRule((p) => ({ ...p, greenhouseNo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    {greenhouseOptions.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-gray-500 mb-1 block">参数类型</label>
                  <select
                    value={newRule.metric}
                    onChange={(e) => setNewRule((p) => ({ ...p, metric: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    {metricOptions.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">最小值</label>
                  <div className={`flex items-center border rounded-lg overflow-hidden ${
                    newRule.maxThreshold <= newRule.minThreshold
                      ? "border-red-400 focus-within:border-red-500"
                      : "border-gray-200 focus-within:border-green-400"
                  }`}>
                    <input
                      type="number"
                      value={newRule.minThreshold}
                      onChange={(e) => setNewRule((p) => ({ ...p, minThreshold: Number(e.target.value) }))}
                      placeholder={metricPlaceholders[newRule.metric]?.min ?? "下限值"}
                      title="请输入该参数的下限值（最小值）"
                      className="w-full px-3 py-2 text-sm outline-none"
                    />
                    <span className="px-2 text-xs text-gray-500 bg-gray-50 border-l border-gray-200">{metricUnit(newRule.metric)}</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">最大值</label>
                  <div className={`flex items-center border rounded-lg overflow-hidden ${
                    newRule.maxThreshold <= newRule.minThreshold
                      ? "border-red-400 focus-within:border-red-500"
                      : "border-gray-200 focus-within:border-green-400"
                  }`}>
                    <input
                      type="number"
                      value={newRule.maxThreshold}
                      onChange={(e) => setNewRule((p) => ({ ...p, maxThreshold: Number(e.target.value) }))}
                      placeholder={metricPlaceholders[newRule.metric]?.max ?? "上限值"}
                      title="请输入该参数的上限值（最大值）"
                      className="w-full px-3 py-2 text-sm outline-none"
                    />
                    <span className="px-2 text-xs text-gray-500 bg-gray-50 border-l border-gray-200">{metricUnit(newRule.metric)}</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">状态</label>
                  <select
                    value={newRule.enabled ? "true" : "false"}
                    onChange={(e) => setNewRule((p) => ({ ...p, enabled: e.target.value === "true" }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    <option value="true">启用</option>
                    <option value="false">停用</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <p className={`text-xs ${newRule.maxThreshold <= newRule.minThreshold ? "text-red-600" : "text-gray-600"}`}>
                  填写说明：最小值是安全下限，最大值是安全上限；监测值低于下限或高于上限会触发告警。
                {" "}
                  {metricPlaceholders[newRule.metric]?.hint}
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowAddRule(false)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateRule}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  创建
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => {
              const draft = drafts[rule.key];
              if (!draft) {
                return null;
              }
              return (
                <div
                  key={rule.key}
                  className={`rounded-xl border p-5 shadow-sm transition-colors ${
                    rule.enabled
                      ? "bg-white border-gray-100"
                      : "bg-gray-100 border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`p-2 rounded-xl shrink-0 ${rule.enabled ? "bg-yellow-50" : "bg-gray-200"}`}>
                      <Bell className={`w-5 h-5 ${rule.enabled ? "text-yellow-500" : "text-gray-500"}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-sm font-semibold truncate ${rule.enabled ? "text-gray-800" : "text-gray-500"}`}>{greenhouseLabel(rule.greenhouseNo)} - {metricLabel(rule.metric)}</h3>
                      <p className={`text-xs mt-0.5 ${rule.enabled ? "text-gray-500" : "text-gray-400"}`}>当前区间：{draft.minThreshold} ~ {draft.maxThreshold} {metricUnit(draft.metric)}</p>
                    </div>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${rule.enabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                      {rule.enabled ? "启用" : "停用"}
                    </span>
                  </div>

                  <div className={`h-1.5 rounded-full overflow-hidden mb-4 ${rule.enabled ? "bg-gray-100" : "bg-gray-300"}`}>
                    <div className={`h-full w-1/2 ${rule.enabled ? metricTheme(draft.metric).bar : "bg-gray-400"}`} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">大棚号</label>
                      <select
                        value={draft.greenhouseNo}
                        onChange={(e) => updateDraft(rule.key, { greenhouseNo: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                      >
                        {greenhouseOptions.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">参数</label>
                      <select
                        value={draft.metric}
                        onChange={(e) => updateDraft(rule.key, { metric: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                      >
                        {metricOptions.map((m) => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">最小值 ({metricUnit(draft.metric)})</label>
                      <div className={`flex items-center border rounded-lg overflow-hidden ${
                        draft.maxThreshold <= draft.minThreshold
                          ? "border-red-400 focus-within:border-red-500"
                          : "border-gray-200 focus-within:border-green-400"
                      }`}>
                        <input
                          type="number"
                          value={draft.minThreshold}
                          onChange={(e) => updateDraft(rule.key, { minThreshold: Number(e.target.value) })}
                          placeholder={metricPlaceholders[draft.metric]?.min ?? "下限值"}
                          title="请输入该参数的下限值（最小值）"
                          className="w-full px-3 py-2 text-sm outline-none"
                        />
                        <span className="px-2 text-xs text-gray-500 bg-gray-50 border-l border-gray-200">{metricUnit(draft.metric)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">最大值 ({metricUnit(draft.metric)})</label>
                      <div className={`flex items-center border rounded-lg overflow-hidden ${
                        draft.maxThreshold <= draft.minThreshold
                          ? "border-red-400 focus-within:border-red-500"
                          : "border-gray-200 focus-within:border-green-400"
                      }`}>
                        <input
                          type="number"
                          value={draft.maxThreshold}
                          onChange={(e) => updateDraft(rule.key, { maxThreshold: Number(e.target.value) })}
                          placeholder={metricPlaceholders[draft.metric]?.max ?? "上限值"}
                          title="请输入该参数的上限值（最大值）"
                          className="w-full px-3 py-2 text-sm outline-none"
                        />
                        <span className="px-2 text-xs text-gray-500 bg-gray-50 border-l border-gray-200">{metricUnit(draft.metric)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded-md ${rule.enabled ? metricTheme(draft.metric).chip : "bg-gray-200 text-gray-500"}`}>
                      {metricPlaceholders[draft.metric]?.hint}
                    </span>
                    <span className={draft.maxThreshold <= draft.minThreshold ? "text-red-600" : "text-gray-500"}>
                      {draft.maxThreshold <= draft.minThreshold ? "上限必须大于下限" : "区间外触发告警"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleSaveRule(rule.key)}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => handleToggleRule(rule.key)}
                      className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-1"
                    >
                      <Power className="w-3.5 h-3.5" />
                      {rule.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      onClick={() => setPendingDeleteKey(rule.key)}
                      className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {!loading && rules.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              <X className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无阈值规则，请先创建规则开始监测。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
