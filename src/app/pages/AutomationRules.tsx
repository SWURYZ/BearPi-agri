import { useCallback, useEffect, useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle,
} from "lucide-react";
import {
  createCompositeRule,
  deleteCompositeRule,
  fetchCompositeRules,
  fetchRuleLogs,
  toggleCompositeRule,
  updateCompositeRule,
  type CompositeRuleResponse,
  type LinkageLogResponse,
} from "../services/compositeCondition";

type UiCondition = {
  sensor: string;
  operator: string;
  value: number;
  unit: string;
};

type UiRule = {
  id: number;
  name: string;
  gh: string;
  logic: "AND" | "OR";
  status: "启用" | "禁用";
  conditions: UiCondition[];
  actionDevice: string;
  actionOperation: "开启" | "关闭";
  triggerCount: number;
  lastTriggered: string;
};

type UiLog = {
  id: string;
  name: string;
  time: string;
  result: string;
  desc: string;
};

const GREENHOUSES = ["1号大棚", "2号大棚", "3号大棚", "5号大棚"];

const GREENHOUSE_DEVICE_MAP: Record<string, string> = {
  "1号大棚": "69d75b1d7f2e6c302f654fea_20031104",
  "2号大棚": "69d75b1d7f2e6c302f654fea_20031104",
  "3号大棚": "69d75b1d7f2e6c302f654fea_20031104",
  "5号大棚": "69d75b1d7f2e6c302f654fea_20031104",
};

const SENSOR_OPTIONS = [
  { label: "空气温度", metric: "Temperature", unit: "°C" },
  { label: "空气湿度", metric: "Humidity", unit: "%" },
  { label: "光照强度", metric: "Luminance", unit: "lux" },
  { label: "土壤温度", metric: "soil_temperature", unit: "°C" },
  { label: "土壤湿度", metric: "soil_humidity", unit: "%" },
  { label: "CO2浓度", metric: "co2", unit: "ppm" },
];

const OPERATOR_TO_BACKEND: Record<string, string> = {
  ">": "GT",
  ">=": "GTE",
  "<": "LT",
  "<=": "LTE",
  "=": "EQ",
  "!=": "NEQ",
};

const BACKEND_TO_OPERATOR: Record<string, string> = {
  GT: ">",
  GTE: ">=",
  LT: "<",
  LTE: "<=",
  EQ: "=",
  NEQ: "!=",
};

const DEVICE_ACTION_OPTIONS = [
  { label: "补光灯", commandType: "LIGHT_CONTROL" as const },
  { label: "灌溉水泵", commandType: "MOTOR_CONTROL" as const },
];

function sensorByMetric(metric: string) {
  return SENSOR_OPTIONS.find((s) => s.metric === metric) || {
    label: metric,
    metric,
    unit: "",
  };
}

function formatTime(ts?: string) {
  if (!ts) return "从未触发";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function logResult(dispatchStatus: string) {
  if (dispatchStatus === "SENT") return "已触发";
  if (dispatchStatus === "FAILED") return "执行失败";
  if (dispatchStatus === "SKIPPED") return "已跳过";
  return dispatchStatus;
}

function resolveGreenhouseByDevice(deviceId?: string) {
  if (!deviceId) return "1号大棚";
  const found = Object.entries(GREENHOUSE_DEVICE_MAP).find(([, d]) => d === deviceId);
  return found?.[0] || "1号大棚";
}

function LogBadge({ status }: { status: string }) {
  if (status === "已触发") return <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">已触发</span>;
  if (status === "执行失败") return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">执行失败</span>;
  return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{status}</span>;
}

export function AutomationRules() {
  const [rules, setRules] = useState<UiRule[]>([]);
  const [logs, setLogs] = useState<UiLog[]>([]);
  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
  const [showAdd, setShowAdd] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newRule, setNewRule] = useState({
    name: "",
    gh: "1号大棚",
    logic: "AND" as "AND" | "OR",
    conditions: [{ sensor: "空气温度", operator: ">", value: 30, unit: "°C" }],
    actionDevice: "补光灯",
    actionOperation: "开启" as "开启" | "关闭",
  });

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const backendRules = await fetchCompositeRules();
      const uiRules: UiRule[] = await Promise.all(
        backendRules.map(async (rule: CompositeRuleResponse) => {
          const conditions: UiCondition[] = rule.conditions.map((c) => {
            const sensor = sensorByMetric(c.sensorMetric);
            return {
              sensor: sensor.label,
              operator: BACKEND_TO_OPERATOR[c.operator] || c.operator,
              value: c.threshold,
              unit: sensor.unit,
            };
          });

          const actionDevice =
            DEVICE_ACTION_OPTIONS.find((x) => x.commandType === rule.commandType)?.label || rule.commandType;
          const actionOperation = (rule.commandAction === "OFF" ? "关闭" : "开启") as "开启" | "关闭";

          let triggerCount = 0;
          let lastTriggered = "从未触发";
          try {
            const l = await fetchRuleLogs(rule.id);
            triggerCount = l.length;
            if (l.length > 0) {
              lastTriggered = formatTime(l[0].triggeredAt);
            }
          } catch {
            // ignore log failures for list page
          }

          return {
            id: rule.id,
            name: rule.name,
            gh: resolveGreenhouseByDevice(rule.targetDeviceId),
            logic: rule.logicOperator,
            status: rule.enabled ? "启用" : "禁用",
            conditions,
            actionDevice,
            actionOperation,
            triggerCount,
            lastTriggered,
          };
        }),
      );

      setRules(uiRules);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    const backendRules = await fetchCompositeRules();
    const batches = await Promise.all(backendRules.map((r) => fetchRuleLogs(r.id)));
    const merged: LinkageLogResponse[] = batches.flat();
    merged.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

    setLogs(
      merged.slice(0, 100).map((log) => ({
        id: `AR-${String(log.ruleId).padStart(3, "0")}`,
        name: log.ruleName,
        time: formatTime(log.triggeredAt),
        result: logResult(log.dispatchStatus),
        desc: `${log.commandType} ${log.commandAction} -> ${log.targetDeviceId}${log.errorMessage ? ` (${log.errorMessage})` : ""}`,
      })),
    );
  }, []);

  useEffect(() => {
    void loadRules();
    void loadLogs();
  }, [loadRules, loadLogs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadRules();
      void loadLogs();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadRules, loadLogs]);

  function resetRuleForm() {
    setNewRule({
      name: "",
      gh: "1号大棚",
      logic: "AND",
      conditions: [{ sensor: "空气温度", operator: ">", value: 30, unit: "°C" }],
      actionDevice: "补光灯",
      actionOperation: "开启",
    });
  }

  function addCondition() {
    setNewRule((p) => ({
      ...p,
      conditions: [...p.conditions, { sensor: "空气温度", operator: ">", value: 25, unit: "°C" }],
    }));
  }

  function startCreate() {
    setEditingRuleId(null);
    resetRuleForm();
    setShowAdd(true);
  }

  function startEdit(rule: UiRule) {
    setEditingRuleId(rule.id);
    setNewRule({
      name: rule.name,
      gh: rule.gh,
      logic: rule.logic,
      conditions: rule.conditions.map((c) => ({ ...c })),
      actionDevice: rule.actionDevice,
      actionOperation: rule.actionOperation,
    });
    setShowAdd(true);
  }

  async function saveRule() {
    if (!newRule.name.trim()) return;

    const targetDeviceId = GREENHOUSE_DEVICE_MAP[newRule.gh] || GREENHOUSE_DEVICE_MAP["1号大棚"];
    const deviceAction = DEVICE_ACTION_OPTIONS.find((x) => x.label === newRule.actionDevice) || DEVICE_ACTION_OPTIONS[0];
    const commandAction = newRule.actionOperation === "关闭" ? "OFF" : "ON";

    const payload = {
      name: newRule.name,
      description: `${newRule.gh} 自动联动规则`,
      logicOperator: newRule.logic,
      enabled: true,
      targetDeviceId,
      commandType: deviceAction.commandType,
      commandAction,
      conditions: newRule.conditions.map((c) => {
        const sensor = SENSOR_OPTIONS.find((s) => s.label === c.sensor) || SENSOR_OPTIONS[0];
        return {
          sensorMetric: sensor.metric,
          sourceDeviceId: targetDeviceId,
          operator: (OPERATOR_TO_BACKEND[c.operator] || "GT") as "GT" | "GTE" | "LT" | "LTE" | "EQ" | "NEQ",
          threshold: Number(c.value),
        };
      }),
    };

    if (editingRuleId == null) {
      await createCompositeRule(payload);
      setNotice({ type: "success", text: "规则创建成功" });
    } else {
      await updateCompositeRule(editingRuleId, payload);
      setNotice({ type: "success", text: "规则修改成功" });
    }

    setEditingRuleId(null);
    setShowAdd(false);
    resetRuleForm();

    await loadRules();
    await loadLogs();
  }

  async function toggleRule(id: number, status: "启用" | "禁用") {
    setBusyRuleId(id);
    setNotice(null);
    const nextEnabled = status !== "启用";
    setRules((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: nextEnabled ? "启用" : "禁用",
            }
          : r,
      ),
    );
    try {
      await toggleCompositeRule(id, nextEnabled);
      await loadRules();
      await loadLogs();
      setNotice({ type: "success", text: `规则已${nextEnabled ? "启用" : "禁用"}` });
    } catch (error) {
      setRules((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
              }
            : r,
        ),
      );
      const msg = error instanceof Error ? error.message : "切换失败，请稍后重试";
      setNotice({ type: "error", text: msg });
    } finally {
      setBusyRuleId(null);
    }
  }

  async function removeRule(id: number) {
    await deleteCompositeRule(id);
    await loadRules();
    await loadLogs();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">复合条件联动控制</h1>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            notice.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {["农户组合条件", "后端实时数据流匹配", "全部条件命中", "自动下发设备指令", "操作记录入库"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <span className="text-xs bg-white border border-purple-200 text-purple-700 px-2.5 py-1 rounded-lg font-medium shadow-sm">{step}</span>
            {i < 4 && <ChevronRight className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">规则引擎默认每 10 秒扫描一次，命中后通常在一个扫描周期内出现在执行记录中。</p>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "rules" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          联动规则
        </button>
        <button
          onClick={() => {
            setActiveTab("logs");
            void loadLogs();
          }}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "logs" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          执行记录
        </button>
      </div>

      {activeTab === "rules" && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">当前规则来自后端 composite-condition-service，删除后不会自动恢复。</p>
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              新建联动规则
            </button>
          </div>

          {showAdd && (
            <div className="bg-white rounded-xl border-2 border-green-300 p-5 shadow-sm space-y-4">
              <h4 className="text-sm font-semibold text-gray-800">{editingRuleId == null ? "新建联动规则" : "编辑联动规则"}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">规则名称</label>
                  <input
                    value={newRule.name}
                    onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
                    placeholder="如：高温自动通风"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">所属大棚</label>
                  <select
                    value={newRule.gh}
                    onChange={(e) => setNewRule((p) => ({ ...p, gh: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    {GREENHOUSES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">条件逻辑</label>
                  <select
                    value={newRule.logic}
                    onChange={(e) => setNewRule((p) => ({ ...p, logic: e.target.value as "AND" | "OR" }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    <option value="AND">AND（全部满足）</option>
                    <option value="OR">OR（任一满足）</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">触发条件</label>
                  <button onClick={addCondition} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> 添加条件
                  </button>
                </div>
                <div className="space-y-2">
                  {newRule.conditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                      {idx > 0 ? (
                        <span className="text-xs font-bold text-purple-600 w-8 text-center">{newRule.logic}</span>
                      ) : (
                        <span className="text-xs text-gray-400 w-8 text-center">当</span>
                      )}

                      <select
                        value={cond.sensor}
                        onChange={(e) => {
                          const next = [...newRule.conditions];
                          const selected = SENSOR_OPTIONS.find((s) => s.label === e.target.value) || SENSOR_OPTIONS[0];
                          next[idx] = { ...next[idx], sensor: selected.label, unit: selected.unit };
                          setNewRule((p) => ({ ...p, conditions: next }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none flex-1"
                      >
                        {SENSOR_OPTIONS.map((s) => (
                          <option key={s.metric}>{s.label}</option>
                        ))}
                      </select>

                      <select
                        value={cond.operator}
                        onChange={(e) => {
                          const next = [...newRule.conditions];
                          next[idx] = { ...next[idx], operator: e.target.value };
                          setNewRule((p) => ({ ...p, conditions: next }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none w-20"
                      >
                        {Object.keys(OPERATOR_TO_BACKEND).map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        value={cond.value}
                        onChange={(e) => {
                          const next = [...newRule.conditions];
                          next[idx] = { ...next[idx], value: Number(e.target.value) };
                          setNewRule((p) => ({ ...p, conditions: next }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none w-24"
                      />
                      <span className="text-xs text-gray-400">{cond.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">执行动作</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newRule.actionDevice}
                    onChange={(e) => setNewRule((p) => ({ ...p, actionDevice: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    {DEVICE_ACTION_OPTIONS.map((d) => (
                      <option key={d.commandType}>{d.label}</option>
                    ))}
                  </select>
                  <select
                    value={newRule.actionOperation}
                    onChange={(e) => setNewRule((p) => ({ ...p, actionOperation: e.target.value as "开启" | "关闭" }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    <option>开启</option>
                    <option>关闭</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowAdd(false);
                    setEditingRuleId(null);
                    resetRuleForm();
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button onClick={() => void saveRule()} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                  {editingRuleId == null ? "保存规则" : "保存修改"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {loading && <div className="text-sm text-gray-500">加载中...</div>}
            {!loading && rules.length === 0 && <div className="text-sm text-gray-500">暂无规则</div>}

            {rules.map((rule) => (
              <div key={rule.id} className={`bg-white rounded-xl border-2 p-5 shadow-sm transition-all ${rule.status === "启用" ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Zap className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-800">{rule.name}</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{rule.gh}</span>
                        <span className="text-xs text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full font-medium">{rule.logic}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">AR-{String(rule.id).padStart(3, "0")} · 触发 {rule.triggerCount} 次 · 最后触发: {rule.lastTriggered}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(rule)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => void toggleRule(rule.id, rule.status)}
                      disabled={busyRuleId === rule.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        rule.status === "启用"
                          ? "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"
                          : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100"
                      } ${busyRuleId === rule.id ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {rule.status === "启用" ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {busyRuleId === rule.id ? "切换中..." : rule.status}
                    </button>
                    <button onClick={() => void removeRule(rule.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-500 mb-2">触发条件</div>
                    <div className="space-y-1.5">
                      {rule.conditions.map((cond, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {i > 0 ? <span className="text-xs font-bold text-purple-600 w-8">{rule.logic}</span> : <span className="text-xs text-gray-400 w-8">当</span>}
                          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 text-xs text-orange-700">
                            <span className="font-medium">{cond.sensor}</span>
                            <span>{cond.operator}</span>
                            <span className="font-bold">{cond.value}{cond.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center self-center">
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>

                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-500 mb-2">执行动作</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">则</span>
                      <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 text-xs text-green-700">
                        <span className="font-medium">{rule.actionDevice}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${rule.actionOperation === "开启" ? "bg-green-200 text-green-800" : "bg-red-100 text-red-600"}`}>
                          {rule.actionOperation}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "logs" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">所有联动规则的触发与执行记录，自动存入数据库</p>
          {logs.length === 0 && <div className="text-sm text-gray-500">暂无执行记录</div>}
          {logs.map((log, i) => (
            <div key={`${log.id}-${i}`} className={`bg-white rounded-xl border p-4 shadow-sm flex items-start gap-4 ${log.result === "已触发" ? "border-green-100" : "border-gray-100"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${log.result === "已触发" ? "bg-green-100" : "bg-gray-100"}`}>
                {log.result === "已触发" ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Clock className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800">{log.name}</span>
                  <span className="text-xs text-gray-400">{log.id}</span>
                  <LogBadge status={log.result} />
                </div>
                <div className="text-xs text-gray-500">{log.desc}</div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">{log.time}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
