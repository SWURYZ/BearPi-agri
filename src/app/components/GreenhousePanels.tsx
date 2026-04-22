/**
 * 大棚面板:定时规则 / 阈值规则 / 阈值告警记录
 * 用于实时监测页面中放大大棚的"测量数据下方"按钮弹窗。
 * 所有数据按 deviceId 过滤,使其只展示当前大棚相关内容。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Clock, AlertTriangle, Loader, RefreshCw } from "lucide-react";
import {
  fetchScheduleRules,
  createScheduleRule,
  toggleScheduleRule,
  deleteScheduleRule,
  type ScheduleRuleResponse,
} from "../services/deviceControl";
import {
  fetchThresholdRules,
  createThresholdRule,
  toggleThresholdRule,
  deleteThresholdRule,
  fetchThresholdAlertRecords,
  runThresholdCheckNow,
  type ThresholdRule,
  type ThresholdAlertRecord,
  type ThresholdOperator,
} from "../services/thresholdAlert";

// ============================================================
// 通用 Modal 外壳
// ============================================================
interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}
function Modal({ open, title, onClose, children, widthClass = "max-w-3xl" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`w-full ${widthClass} max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// 1. 定时规则
// ============================================================
const REPEAT_LABEL: Record<string, string> = { DAILY: "每天", WEEKDAY: "工作日", WEEKEND: "周末", ONCE: "仅一次" };

interface ScheduleRulesModalProps {
  open: boolean;
  deviceId: string;
  greenhouseLabel: string;
  onClose: () => void;
}
export function ScheduleRulesModal({ open, deviceId, greenhouseLabel, onClose }: ScheduleRulesModalProps) {
  const [rules, setRules] = useState<ScheduleRuleResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({
    ruleName: "补光灯定时",
    turnOnTime: "06:00",
    turnOffTime: "18:00",
    repeat: "DAILY",
    commandType: "LIGHT_CONTROL",
  });
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const all = await fetchScheduleRules();
      setRules(all.filter((r) => r.deviceId === deviceId));
    } catch {
      setMsg({ type: "error", text: "加载失败,请检查后端服务" });
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);

  async function handleAdd() {
    if (!deviceId) return;
    if (draft.turnOnTime >= draft.turnOffTime) {
      setMsg({ type: "error", text: "开启时间不能晚于或等于关闭时间" });
      return;
    }
    try {
      await createScheduleRule({
        deviceId,
        ruleName: draft.ruleName,
        turnOnTime: draft.turnOnTime,
        turnOffTime: draft.turnOffTime,
        repeatMode: draft.repeat,
        commandType: draft.commandType,
        enabled: true,
      });
      setShowAdd(false);
      setMsg({ type: "success", text: "新增成功" });
      void load();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "新增失败" });
    }
  }

  return (
    <Modal open={open} title={`定时规则 — ${greenhouseLabel}`} onClose={onClose}>
      {!deviceId && (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
          当前大棚未绑定真实设备,定时规则仅对真实设备生效。
        </div>
      )}
      {deviceId && (
        <>
          {msg && (
            <div className={`mb-3 text-sm px-3 py-2 rounded-lg border ${
              msg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
            }`}>{msg.text}</div>
          )}

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">设备:<span className="font-mono ml-1">{deviceId}</span></span>
            <div className="flex gap-2">
              <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="刷新">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                <Plus className="w-4 h-4" /> 新增规则
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="bg-green-50/40 border border-green-200 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">控制类型</label>
                  <select value={draft.commandType}
                    onChange={(e) => setDraft((p) => ({ ...p, commandType: e.target.value, ruleName: e.target.value === "LIGHT_CONTROL" ? "补光灯定时" : "灌溉定时" }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400">
                    <option value="LIGHT_CONTROL">补光灯</option>
                    <option value="MOTOR_CONTROL">灌溉</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">规则名称</label>
                  <input type="text" value={draft.ruleName} onChange={(e) => setDraft((p) => ({ ...p, ruleName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">开启时间</label>
                  <input type="time" value={draft.turnOnTime} onChange={(e) => setDraft((p) => ({ ...p, turnOnTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">关闭时间</label>
                  <input type="time" value={draft.turnOffTime} onChange={(e) => setDraft((p) => ({ ...p, turnOffTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">重复</label>
                  <select value={draft.repeat} onChange={(e) => setDraft((p) => ({ ...p, repeat: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400">
                    {Object.entries(REPEAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">取消</button>
                <button onClick={handleAdd} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">确认</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["类型", "名称", "开启", "关闭", "重复", "状态", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/40">
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.commandType === "LIGHT_CONTROL" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                      }`}>{r.commandType === "LIGHT_CONTROL" ? "补光灯" : "灌溉"}</span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{r.ruleName}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-700">{r.turnOnTime}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-700">{r.turnOffTime}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{REPEAT_LABEL[r.repeatMode] || r.repeatMode}</td>
                    <td className="px-3 py-2">
                      <button onClick={async () => { await toggleScheduleRule(r.id, !r.enabled); void load(); }}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.enabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {r.enabled ? "启用" : "禁用"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={async () => { await deleteScheduleRule(r.id); void load(); }}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && rules.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400 flex flex-col items-center gap-1">
                <Clock className="w-8 h-8 opacity-30" />暂无定时规则
              </div>
            )}
            {loading && <div className="text-center py-6 text-sm text-gray-400 flex items-center justify-center gap-2"><Loader className="w-4 h-4 animate-spin" /> 加载中...</div>}
          </div>
        </>
      )}
    </Modal>
  );
}

// ============================================================
// 2. 阈值规则
// ============================================================
const METRIC_OPTIONS = [
  { key: "temp", label: "空气温度", unit: "°C" },
  { key: "humidity", label: "空气湿度", unit: "%" },
  { key: "light", label: "光照强度", unit: "lux" },
  { key: "co2", label: "CO2 浓度", unit: "ppm" },
];
function metricMeta(k: string) {
  return METRIC_OPTIONS.find((m) => m.key === k) ?? { label: k, unit: "" };
}

interface ThresholdRulesModalProps {
  open: boolean;
  deviceId: string;
  greenhouseLabel: string;
  onClose: () => void;
}
export function ThresholdRulesModal({ open, deviceId, greenhouseLabel, onClose }: ThresholdRulesModalProps) {
  const [rules, setRules] = useState<ThresholdRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<{ metric: string; operator: ThresholdOperator; threshold: number }>({ metric: "temp", operator: "ABOVE", threshold: 30 });
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const all = await fetchThresholdRules();
      setRules(all.filter((r) => r.deviceId === deviceId));
    } catch {
      setMsg({ type: "error", text: "加载失败" });
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);

  async function handleAdd() {
    if (!deviceId) return;
    if (!draft.threshold || draft.threshold <= 0) {
      setMsg({ type: "error", text: "阈值必须为正数" });
      return;
    }
    try {
      await createThresholdRule({ deviceId, metric: draft.metric, operator: draft.operator, threshold: draft.threshold, enabled: true });
      setShowAdd(false);
      setMsg({ type: "success", text: "新增成功" });
      void load();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "新增失败" });
    }
  }

  return (
    <Modal open={open} title={`阈值规则 — ${greenhouseLabel}`} onClose={onClose}>
      {!deviceId && (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
          当前大棚未绑定真实设备,阈值规则仅对真实设备生效。
        </div>
      )}
      {deviceId && (
        <>
          {msg && (
            <div className={`mb-3 text-sm px-3 py-2 rounded-lg border ${
              msg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
            }`}>{msg.text}</div>
          )}

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">设备:<span className="font-mono ml-1">{deviceId}</span></span>
            <div className="flex gap-2">
              <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="刷新">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                <Plus className="w-4 h-4" /> 新增规则
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="bg-green-50/40 border border-green-200 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">参数</label>
                <select value={draft.metric} onChange={(e) => setDraft((p) => ({ ...p, metric: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400">
                  {METRIC_OPTIONS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">触发条件</label>
                <select value={draft.operator} onChange={(e) => setDraft((p) => ({ ...p, operator: e.target.value as ThresholdOperator }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400">
                  <option value="ABOVE">超过 (≥)</option>
                  <option value="BELOW">低于 (≤)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">阈值 ({metricMeta(draft.metric).unit})</label>
                <input type="number" value={draft.threshold} onChange={(e) => setDraft((p) => ({ ...p, threshold: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-400" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">取消</button>
                <button onClick={handleAdd} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">确认</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["参数", "条件", "阈值", "状态", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/40">
                    <td className="px-3 py-2 text-sm text-gray-700">{metricMeta(r.metric).label}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.operator === "ABOVE" ? "超过" : "低于"}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-700">{r.threshold} {metricMeta(r.metric).unit}</td>
                    <td className="px-3 py-2">
                      <button onClick={async () => { await toggleThresholdRule(r.id, !r.enabled); void load(); }}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.enabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {r.enabled ? "启用" : "禁用"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={async () => { await deleteThresholdRule(r.id); void load(); }}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && rules.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400 flex flex-col items-center gap-1">
                <AlertTriangle className="w-8 h-8 opacity-30" />暂无阈值规则
              </div>
            )}
            {loading && <div className="text-center py-6 text-sm text-gray-400 flex items-center justify-center gap-2"><Loader className="w-4 h-4 animate-spin" /> 加载中...</div>}
          </div>
        </>
      )}
    </Modal>
  );
}

// ============================================================
// 3. 阈值告警记录
// ============================================================
interface AlertRecordsModalProps {
  open: boolean;
  deviceId: string;
  greenhouseLabel: string;
  onClose: () => void;
}
export function AlertRecordsModal({ open, deviceId, greenhouseLabel, onClose }: AlertRecordsModalProps) {
  const [records, setRecords] = useState<ThresholdAlertRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const all = await fetchThresholdAlertRecords();
      setRecords(all.filter((r) => r.deviceId === deviceId));
    } catch {
      setMsg("加载失败");
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = records.filter((r) => new Date(r.alertedAt) >= today).length;
    return { total: records.length, today: todayCount };
  }, [records]);

  async function handleCheckNow() {
    try {
      await runThresholdCheckNow();
      setMsg("已触发立即检测");
      window.setTimeout(load, 600);
    } catch {
      setMsg("触发失败");
    }
  }

  return (
    <Modal open={open} title={`阈值告警记录 — ${greenhouseLabel}`} onClose={onClose}>
      {!deviceId && (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
          当前大棚未绑定真实设备,无告警记录。
        </div>
      )}
      {deviceId && (
        <>
          {msg && <div className="mb-3 text-sm px-3 py-2 rounded-lg border bg-blue-50 text-blue-700 border-blue-200">{msg}</div>}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-orange-500">{stats.today}</div>
              <div className="text-xs text-gray-500 mt-0.5">今日告警</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-500">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-0.5">累计告警</div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">设备:<span className="font-mono ml-1">{deviceId}</span></span>
            <div className="flex gap-2">
              <button onClick={handleCheckNow} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100">立即检测</button>
              <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="刷新">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["参数", "条件", "阈值/当前", "时间", "信息"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/40">
                    <td className="px-3 py-2 text-sm text-gray-700">{metricMeta(r.metric).label}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.operator === "ABOVE" ? "超过" : "低于"}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className="text-red-500 font-semibold">{r.currentValue.toFixed(2)}</span>
                      <span className="text-gray-400 ml-1">/ {r.threshold}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.alertedAt).toLocaleString("zh-CN", { hour12: false })}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && records.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400 flex flex-col items-center gap-1">
                <AlertTriangle className="w-8 h-8 opacity-30" />暂无告警记录
              </div>
            )}
            {loading && <div className="text-center py-6 text-sm text-gray-400 flex items-center justify-center gap-2"><Loader className="w-4 h-4 animate-spin" /> 加载中...</div>}
          </div>
        </>
      )}
    </Modal>
  );
}
