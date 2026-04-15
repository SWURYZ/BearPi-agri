import { useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Play,
  Clock,
  CheckCircle,
} from "lucide-react";

interface Condition {
  sensor: string;
  operator: string;
  value: string;
  unit: string;
}

interface Action {
  device: string;
  operation: string;
}

interface AutoRule {
  id: string;
  name: string;
  gh: string;
  conditions: Condition[];
  logic: "AND" | "OR";
  actions: Action[];
  status: "启用" | "禁用";
  triggerCount: number;
  lastTriggered: string;
}

const initialRules: AutoRule[] = [
  {
    id: "AR-001",
    name: "高温自动通风",
    gh: "1号大棚",
    conditions: [
      { sensor: "空气温度", operator: ">", value: "30", unit: "°C" },
      { sensor: "空气湿度", operator: ">", value: "75", unit: "%" },
    ],
    logic: "AND",
    actions: [
      { device: "通风风机 #1", operation: "开启" },
      { device: "通风风机 #2", operation: "开启" },
    ],
    status: "启用",
    triggerCount: 12,
    lastTriggered: "2026-04-14 12:35:00",
  },
  {
    id: "AR-002",
    name: "缺水自动灌溉",
    gh: "1号大棚",
    conditions: [
      { sensor: "土壤湿度", operator: "<", value: "30", unit: "%" },
    ],
    logic: "AND",
    actions: [
      { device: "灌溉水泵", operation: "开启" },
    ],
    status: "启用",
    triggerCount: 5,
    lastTriggered: "2026-04-13 08:20:00",
  },
  {
    id: "AR-003",
    name: "强光遮阳保护",
    gh: "2号大棚",
    conditions: [
      { sensor: "光照强度", operator: ">", value: "10000", unit: "lux" },
    ],
    logic: "AND",
    actions: [
      { device: "遮阳帘", operation: "关闭" },
      { device: "补光灯 A区", operation: "关闭" },
    ],
    status: "启用",
    triggerCount: 3,
    lastTriggered: "2026-04-14 13:50:00",
  },
  {
    id: "AR-004",
    name: "CO₂过高通风",
    gh: "3号大棚",
    conditions: [
      { sensor: "CO₂浓度", operator: ">", value: "600", unit: "ppm" },
    ],
    logic: "AND",
    actions: [
      { device: "通风风机 #1", operation: "开启" },
    ],
    status: "禁用",
    triggerCount: 0,
    lastTriggered: "从未触发",
  },
];

const sensors = ["空气温度", "空气湿度", "土壤温度", "土壤湿度", "光照强度", "CO₂浓度"];
const operators = [">", "<", ">=", "<=", "="];
const devices = ["通风风机 #1", "通风风机 #2", "灌溉水泵", "补光灯 A区", "补光灯 B区", "遮阳帘", "喷雾系统", "加热装置"];

const sensorUnits: Record<string, string> = {
  "空气温度": "°C", "空气湿度": "%", "土壤温度": "°C",
  "土壤湿度": "%", "光照强度": "lux", "CO₂浓度": "ppm",
};

function LogBadge({ status }: { status: string }) {
  if (status === "已触发") return <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">已触发</span>;
  if (status === "条件未满足") return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">条件未满足</span>;
  return <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">{status}</span>;
}

const executionLogs = [
  { id: "AR-001", name: "高温自动通风", time: "2026-04-14 14:25:00", result: "已触发", desc: "温度32.1°C > 30°C 且 湿度85% > 75%，已开启双风机" },
  { id: "AR-003", name: "强光遮阳保护", time: "2026-04-14 13:50:00", result: "已触发", desc: "光照11200lux > 10000lux，已关闭遮阳帘" },
  { id: "AR-002", name: "缺水自动灌溉", time: "2026-04-14 10:00:00", result: "条件未满足", desc: "土壤湿度45% ≥ 30%，条件未满足，不执行" },
  { id: "AR-001", name: "高温自动通风", time: "2026-04-13 15:20:00", result: "已触发", desc: "温度31.5°C > 30°C 且 湿度80% > 75%，已开启双风机" },
];

export function AutomationRules() {
  const [rules, setRules] = useState<AutoRule[]>(initialRules);
  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    gh: "1号大棚",
    logic: "AND" as "AND" | "OR",
    conditions: [{ sensor: "空气温度", operator: ">", value: "30", unit: "°C" }],
    actions: [{ device: "通风风机 #1", operation: "开启" }],
  });

  function toggleRule(id: string) {
    setRules((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: r.status === "启用" ? "禁用" : "启用" } : r)
    );
  }

  function deleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function addCondition() {
    setNewRule((p) => ({
      ...p,
      conditions: [...p.conditions, { sensor: "空气温度", operator: ">", value: "25", unit: "°C" }],
    }));
  }

  function addAction() {
    setNewRule((p) => ({
      ...p,
      actions: [...p.actions, { device: "灌溉水泵", operation: "开启" }],
    }));
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">复合条件联动控制</h1>
        
      </div>

      {/* Flow Banner */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {[
          "农户组合条件",
          "后端实时数据流匹配",
          "全部条件命中",
          "自动下发设备指令",
          "操作记录入库",
        ].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <span className="text-xs bg-white border border-purple-200 text-purple-700 px-2.5 py-1 rounded-lg font-medium shadow-sm">
              {step}
            </span>
            {i < 4 && <ChevronRight className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Tabs */}
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
          onClick={() => setActiveTab("logs")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "logs" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          执行记录
        </button>
      </div>

      {activeTab === "rules" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              新建联动规则
            </button>
          </div>

          {/* Add Rule Form */}
          {showAdd && (
            <div className="bg-white rounded-xl border-2 border-green-300 p-5 shadow-sm space-y-4">
              <h4 className="text-sm font-semibold text-gray-800">新建联动规则</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">规则名称</label>
                  <input
                    value={newRule.name}
                    onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
                    placeholder="如：高温自动通风"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">所属大棚</label>
                  <select
                    value={newRule.gh}
                    onChange={(e) => setNewRule((p) => ({ ...p, gh: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    {["1号大棚", "2号大棚", "3号大棚", "5号大棚"].map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">条件逻辑</label>
                  <select
                    value={newRule.logic}
                    onChange={(e) => setNewRule((p) => ({ ...p, logic: e.target.value as "AND" | "OR" }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    <option value="AND">AND（全部满足）</option>
                    <option value="OR">OR（任一满足）</option>
                  </select>
                </div>
              </div>

              {/* Conditions */}
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
                      {idx > 0 && (
                        <span className="text-xs font-bold text-purple-600 w-8 text-center">{newRule.logic}</span>
                      )}
                      {idx === 0 && <span className="text-xs text-gray-400 w-8 text-center">当</span>}
                      <select
                        value={cond.sensor}
                        onChange={(e) => {
                          const nc = [...newRule.conditions];
                          nc[idx] = { ...nc[idx], sensor: e.target.value, unit: sensorUnits[e.target.value] || "" };
                          setNewRule((p) => ({ ...p, conditions: nc }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none flex-1"
                      >
                        {sensors.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <select
                        value={cond.operator}
                        onChange={(e) => {
                          const nc = [...newRule.conditions];
                          nc[idx] = { ...nc[idx], operator: e.target.value };
                          setNewRule((p) => ({ ...p, conditions: nc }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none w-16"
                      >
                        {operators.map((o) => <option key={o}>{o}</option>)}
                      </select>
                      <input
                        type="number"
                        value={cond.value}
                        onChange={(e) => {
                          const nc = [...newRule.conditions];
                          nc[idx] = { ...nc[idx], value: e.target.value };
                          setNewRule((p) => ({ ...p, conditions: nc }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none w-20"
                      />
                      <span className="text-xs text-gray-400">{cond.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">执行动作</label>
                  <button onClick={addAction} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> 添加动作
                  </button>
                </div>
                <div className="space-y-2">
                  {newRule.actions.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                      <span className="text-xs text-gray-400 w-8 text-center">则</span>
                      <select
                        value={action.device}
                        onChange={(e) => {
                          const na = [...newRule.actions];
                          na[idx] = { ...na[idx], device: e.target.value };
                          setNewRule((p) => ({ ...p, actions: na }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none flex-1"
                      >
                        {devices.map((d) => <option key={d}>{d}</option>)}
                      </select>
                      <select
                        value={action.operation}
                        onChange={(e) => {
                          const na = [...newRule.actions];
                          na[idx] = { ...na[idx], operation: e.target.value };
                          setNewRule((p) => ({ ...p, actions: na }));
                        }}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none w-20"
                      >
                        <option>开启</option>
                        <option>关闭</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
                <button
                  onClick={() => {
                    if (!newRule.name) return;
                    setRules((prev) => [...prev, {
                      id: `AR-${String(prev.length + 1).padStart(3, "0")}`,
                      name: newRule.name,
                      gh: newRule.gh,
                      conditions: newRule.conditions,
                      logic: newRule.logic,
                      actions: newRule.actions,
                      status: "启用",
                      triggerCount: 0,
                      lastTriggered: "从未触发",
                    }]);
                    setShowAdd(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  保存规则
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className={`bg-white rounded-xl border-2 p-5 shadow-sm transition-all ${
                rule.status === "启用" ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"
              }`}>
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
                      <div className="text-xs text-gray-400 mt-0.5">{rule.id} · 触发 {rule.triggerCount} 次 · 最后触发: {rule.lastTriggered}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        rule.status === "启用"
                          ? "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"
                          : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {rule.status === "启用" ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {rule.status}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  {/* Conditions */}
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-500 mb-2">触发条件</div>
                    <div className="space-y-1.5">
                      {rule.conditions.map((cond, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {i > 0 && (
                            <span className="text-xs font-bold text-purple-600 w-8">{rule.logic}</span>
                          )}
                          {i === 0 && <span className="text-xs text-gray-400 w-8">当</span>}
                          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 text-xs text-orange-700">
                            <span className="font-medium">{cond.sensor}</span>
                            <span>{cond.operator}</span>
                            <span className="font-bold">{cond.value}{cond.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center self-center">
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>

                  {/* Actions */}
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-500 mb-2">执行动作</div>
                    <div className="space-y-1.5">
                      {rule.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">则</span>
                          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 text-xs text-green-700">
                            <Play className="w-3 h-3" />
                            <span className="font-medium">{action.device}</span>
                            <span className={`px-1.5 py-0.5 rounded font-bold ${
                              action.operation === "开启" ? "bg-green-200 text-green-800" : "bg-red-100 text-red-600"
                            }`}>{action.operation}</span>
                          </div>
                        </div>
                      ))}
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
          {executionLogs.map((log, i) => (
            <div key={i} className={`bg-white rounded-xl border p-4 shadow-sm flex items-start gap-4 ${
              log.result === "已触发" ? "border-green-100" : "border-gray-100"
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                log.result === "已触发" ? "bg-green-100" : "bg-gray-100"
              }`}>
                {log.result === "已触发" ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-400" />
                )}
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
