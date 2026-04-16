import { useState, useEffect, useCallback } from "react";
import {
  Power,
  Clock,
  Fan,
  Droplets,
  Sun,
  Thermometer,
  Plus,
  Trash2,
  CheckCircle,
  Loader,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  sendManualControl,
  fetchDeviceStatus,
  fetchScheduleRules,
  createScheduleRule,
  toggleScheduleRule,
  deleteScheduleRule,
  type ScheduleRuleResponse,
  type DeviceStatusResponse,
} from "../services/deviceControl";

/* -------- 真实设备 ID（华为云 IoT 平台注册的设备） -------- */
const REAL_DEVICE_ID = "69d75b1d7f2e6c302f654fea_20031104";

type DeviceStatus = "on" | "off" | "loading" | "error";

interface Device {
  id: string;
  name: string;
  type: string;
  gh: string;
  status: DeviceStatus;
  icon: React.ElementType;
  color: string;
  commandType: string;
  feedback?: string;
}

const initialDevices: Device[] = [
  { id: REAL_DEVICE_ID, name: "补光灯", type: "补光灯", gh: "1号大棚", status: "off", icon: Sun, color: "yellow", commandType: "LIGHT_CONTROL" },
  { id: REAL_DEVICE_ID, name: "电机/风机", type: "电机", gh: "1号大棚", status: "off", icon: Fan, color: "blue", commandType: "MOTOR_CONTROL" },
];

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", icon: "text-blue-500" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-600", icon: "text-cyan-500" },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-600", icon: "text-yellow-500" },
  red: { bg: "bg-red-50", text: "text-red-600", icon: "text-red-500" },
  orange: { bg: "bg-orange-50", text: "text-orange-600", icon: "text-orange-500" },
  teal: { bg: "bg-teal-50", text: "text-teal-600", icon: "text-teal-500" },
};

export function DeviceControl() {
  const [activeTab, setActiveTab] = useState<"manual" | "timer">("manual");
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [timers, setTimers] = useState<ScheduleRuleResponse[]>([]);
  const [showAddTimer, setShowAddTimer] = useState(false);
  const [newTimer, setNewTimer] = useState({ ruleName: "补光灯定时", turnOnTime: "06:00", turnOffTime: "18:00", repeat: "DAILY", commandType: "LIGHT_CONTROL" });
  const [timerMessage, setTimerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* -------- 初始化：从后端拉取设备状态 -------- */
  useEffect(() => {
    fetchDeviceStatus(REAL_DEVICE_ID)
      .then((status: DeviceStatusResponse) => {
        if (!status) return;
        setDevices((prev) =>
          prev.map((d) => {
            if (d.commandType === "LIGHT_CONTROL" && status.ledStatus) {
              return { ...d, status: status.ledStatus === "ON" ? "on" : "off" };
            }
            if (d.commandType === "MOTOR_CONTROL" && status.motorStatus) {
              return { ...d, status: status.motorStatus === "ON" ? "on" : "off" };
            }
            return d;
          })
        );
      })
      .catch(() => { /* 后端未启动时 fallback */ });
  }, []);

  /* -------- 初始化：从后端拉取定时规则 -------- */
  const loadRules = useCallback(async () => {
    try {
      const rules = await fetchScheduleRules();
      setTimers(rules);
    } catch {
      /* 后端未启动时 fallback */
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  /* -------- 手动控制：调用 device-control-service -------- */
  async function handleToggle(deviceIndex: number) {
    const device = devices[deviceIndex];
    const prevStatus = device.status;
    const targetAction = prevStatus === "on" ? "OFF" : "ON";

    setDevices((prev) =>
      prev.map((d, i) => (i === deviceIndex ? { ...d, status: "loading" as DeviceStatus, feedback: undefined } : d))
    );

    try {
      const resp = await sendManualControl({
        deviceId: device.id,
        commandType: device.commandType,
        action: targetAction,
      });

      const newStatus: DeviceStatus = resp.status === "SENT" || resp.status === "DELIVERED"
        ? (targetAction === "ON" ? "on" : "off")
        : "error";

      setDevices((prev) =>
        prev.map((d, i) =>
          i === deviceIndex
            ? { ...d, status: newStatus, feedback: resp.message }
            : d
        )
      );
    } catch (err) {
      setDevices((prev) =>
        prev.map((d, i) =>
          i === deviceIndex
            ? { ...d, status: prevStatus, feedback: "网络错误，请检查后端服务是否启动" }
            : d
        )
      );
    }
  }

  /* -------- 新增定时规则：调用 light-schedule-service -------- */
  async function addTimer() {
    if (newTimer.turnOnTime >= newTimer.turnOffTime) {
      setTimerMessage({ type: "error", text: "新增失败：开灯时间不能晚于或等于关灯时间" });
      window.setTimeout(() => setTimerMessage(null), 2600);
      return;
    }
    try {
      await createScheduleRule({
        deviceId: REAL_DEVICE_ID,
        ruleName: newTimer.ruleName,
        turnOnTime: newTimer.turnOnTime,
        turnOffTime: newTimer.turnOffTime,
        repeatMode: newTimer.repeat,
        commandType: newTimer.commandType,
        enabled: true,
      });
      setShowAddTimer(false);
      setTimerMessage({ type: "success", text: "新增成功" });
      loadRules();
      window.setTimeout(() => setTimerMessage(null), 2200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "新增失败，请检查后端服务";
      setTimerMessage({ type: "error", text: msg });
      window.setTimeout(() => setTimerMessage(null), 3000);
    }
  }

  /* -------- 删除定时规则 -------- */
  async function handleDeleteRule(id: number) {
    try {
      await deleteScheduleRule(id);
      await loadRules();
      setTimerMessage({ type: "success", text: "删除成功" });
      window.setTimeout(() => setTimerMessage(null), 2200);
    } catch {
      setTimerMessage({ type: "error", text: "删除失败，请检查后端服务" });
      window.setTimeout(() => setTimerMessage(null), 2600);
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">设备远程控制</h1>
        
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("manual")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "manual" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Power className="w-4 h-4" />
          手动控制
        </button>
        <button
          onClick={() => setActiveTab("timer")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "timer" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          定时规则
        </button>
      </div>

      {activeTab === "manual" && (
        <>
          {/* MQTT Flow Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
            <div className="text-blue-500">📡</div>
            <div className="text-xs text-blue-700">
              <span className="font-medium">控制流程：</span>
              点击按钮 → 后端封装 MQTT 指令 → 华为云 IoT 平台下发 → 硬件执行 → 反馈状态
            </div>
          </div>

          {/* Device Group */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <h3 className="text-sm font-semibold text-gray-800">1号大棚 — BearPi 设备</h3>
              <span className="text-xs text-gray-400 font-mono truncate">{REAL_DEVICE_ID}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {devices.map((device, idx) => {
                const colors = colorMap[device.color] || colorMap.blue;
                return (
                  <div key={`${device.id}-${device.commandType}`} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-xl ${colors.bg}`}>
                        <device.icon className={`w-5 h-5 ${colors.icon}`} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {device.status === "loading" ? (
                          <Loader className="w-4 h-4 text-gray-400 animate-spin" />
                        ) : device.status === "on" ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : device.status === "error" ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-200" />
                        )}
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-0.5">{device.name}</h3>
                    <div className="text-xs text-gray-400 mb-3 truncate">{device.type}</div>

                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          device.status === "on" ? "text-green-600" :
                          device.status === "loading" ? "text-gray-400" :
                          "text-gray-400"
                        }`}
                      >
                        {device.status === "on" ? "运行中" : device.status === "loading" ? "执行中..." : "已停止"}
                      </span>
                      <button
                        onClick={() => handleToggle(idx)}
                        disabled={device.status === "loading"}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          device.status === "on"
                            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                            : device.status === "loading"
                            ? "bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                        }`}
                      >
                        {device.status === "on" ? (
                          <><ToggleRight className="w-3.5 h-3.5" />关闭</>
                        ) : device.status === "loading" ? (
                          <><Loader className="w-3.5 h-3.5 animate-spin" />执行中</>
                        ) : (
                          <><ToggleLeft className="w-3.5 h-3.5" />开启</>
                        )}
                      </button>
                    </div>

                    {device.feedback && (
                      <div className="mt-2 text-xs text-green-600 bg-green-50 rounded-lg px-2 py-1 truncate">
                        ✓ {device.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === "timer" && (
        <>
          {timerMessage && (
            <div
              className={`text-sm px-3 py-2 rounded-lg border ${
                timerMessage.type === "success"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              {timerMessage.text}
            </div>
          )}

          <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
            <div className="text-green-500">⏰</div>
            <div className="text-xs text-green-700">
              <span className="font-medium">定时控制：</span>
              农户配置定时规则 → 后端调度中心每分钟扫描 → 到达时间点自动下发开启/关闭指令 → 系统记录执行状态
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">定时规则列表</h3>
            <button
              onClick={() => setShowAddTimer(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增规则
            </button>
          </div>

          {/* Add Timer Form */}
          {showAddTimer && (
            <div className="bg-white rounded-xl border-2 border-green-300 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-800 mb-4">新增定时规则</h4>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">控制类型</label>
                  <select
                    value={newTimer.commandType}
                    onChange={(e) => setNewTimer((p) => ({ ...p, commandType: e.target.value, ruleName: e.target.value === "LIGHT_CONTROL" ? "补光灯定时" : "灌溉定时" }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    <option value="LIGHT_CONTROL">补光灯定时</option>
                    <option value="MOTOR_CONTROL">灌溉定时</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">规则名称</label>
                  <input
                    type="text"
                    value={newTimer.ruleName}
                    onChange={(e) => setNewTimer((p) => ({ ...p, ruleName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                    placeholder="如: 补光灯早间定时"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">开启时间</label>
                  <input
                    type="time"
                    value={newTimer.turnOnTime}
                    onChange={(e) => setNewTimer((p) => ({ ...p, turnOnTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">关闭时间</label>
                  <input
                    type="time"
                    value={newTimer.turnOffTime}
                    onChange={(e) => setNewTimer((p) => ({ ...p, turnOffTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">重复模式</label>
                  <select
                    value={newTimer.repeat}
                    onChange={(e) => setNewTimer((p) => ({ ...p, repeat: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    {[
                      { value: "DAILY", label: "每天" },
                      { value: "WEEKDAY", label: "工作日" },
                      { value: "WEEKEND", label: "周末" },
                      { value: "ONCE", label: "仅一次" },
                    ].map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowAddTimer(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
                <button onClick={addTimer} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">确认添加</button>
              </div>
            </div>
          )}

          {/* Timer Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["ID", "控制类型", "规则名称", "开启时间", "关闭时间", "重复模式", "状态", "操作"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {timers.map((rule, index) => (
                  <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{index + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rule.commandType === "LIGHT_CONTROL" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {rule.commandType === "LIGHT_CONTROL" ? "补光灯" : "灌溉"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{rule.ruleName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{rule.turnOnTime}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{rule.turnOffTime}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {{ DAILY: "每天", WEEKDAY: "工作日", WEEKEND: "周末", ONCE: "仅一次" }[rule.repeatMode] || rule.repeatMode}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          await toggleScheduleRule(rule.id, !rule.enabled);
                          loadRules();
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                          rule.enabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {rule.enabled ? "启用" : "禁用"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {timers.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">暂无定时规则，点击「新增规则」添加</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
