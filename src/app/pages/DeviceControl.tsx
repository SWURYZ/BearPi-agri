import { useState } from "react";
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

type DeviceStatus = "on" | "off" | "loading" | "error";

interface Device {
  id: string;
  name: string;
  type: string;
  gh: string;
  status: DeviceStatus;
  icon: React.ElementType;
  color: string;
  feedback?: string;
}

const initialDevices: Device[] = [
  { id: "DEV-001", name: "通风风机 #1", type: "风机", gh: "1号大棚", status: "on", icon: Fan, color: "blue" },
  { id: "DEV-002", name: "通风风机 #2", type: "风机", gh: "1号大棚", status: "off", icon: Fan, color: "blue" },
  { id: "DEV-003", name: "灌溉水泵", type: "水泵", gh: "1号大棚", status: "off", icon: Droplets, color: "cyan" },
  { id: "DEV-004", name: "补光灯 A区", type: "补光灯", gh: "1号大棚", status: "on", icon: Sun, color: "yellow" },
  { id: "DEV-005", name: "补光灯 B区", type: "补光灯", gh: "1号大棚", status: "off", icon: Sun, color: "yellow" },
  { id: "DEV-006", name: "加热装置", type: "加热", gh: "1号大棚", status: "off", icon: Thermometer, color: "red" },
  { id: "DEV-007", name: "遮阳帘", type: "遮阳", gh: "2号大棚", status: "on", icon: Sun, color: "orange" },
  { id: "DEV-008", name: "喷雾系统", type: "喷雾", gh: "2号大棚", status: "off", icon: Droplets, color: "teal" },
];

interface TimerRule {
  id: string;
  device: string;
  action: "开启" | "关闭";
  time: string;
  repeat: string;
  status: "启用" | "禁用";
}

const initialTimers: TimerRule[] = [
  { id: "T-001", device: "补光灯 A区", action: "开启", time: "06:00", repeat: "每天", status: "启用" },
  { id: "T-002", device: "补光灯 A区", action: "关闭", time: "18:00", repeat: "每天", status: "启用" },
  { id: "T-003", device: "灌溉水泵", action: "开启", time: "07:30", repeat: "周一三五", status: "启用" },
  { id: "T-004", device: "灌溉水泵", action: "关闭", time: "08:00", repeat: "周一三五", status: "启用" },
  { id: "T-005", device: "补光灯 B区", action: "开启", time: "08:00", repeat: "每天", status: "禁用" },
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
  const [timers, setTimers] = useState<TimerRule[]>(initialTimers);
  const [selectedGH, setSelectedGH] = useState("1号大棚");
  const [showAddTimer, setShowAddTimer] = useState(false);
  const [newTimer, setNewTimer] = useState({ device: "补光灯 A区", action: "开启" as "开启" | "关闭", time: "09:00", repeat: "每天" });
  const [timerMessage, setTimerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredDevices = devices.filter((d) => d.gh === selectedGH);

  function handleToggle(id: string) {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "loading" as DeviceStatus } : d))
    );
    setTimeout(() => {
      setDevices((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          const newStatus: DeviceStatus = d.status === "loading"
            ? (prev.find((x) => x.id === id)?.status === "on" ? "off" : "on")
            : d.status === "on" ? "off" : "on";
          return { ...d, status: newStatus, feedback: `指令已执行，设备${newStatus === "on" ? "开启" : "关闭"}` };
        })
      );
    }, 1200);
  }

  function addTimer() {
    const exists = timers.some(
      (rule) => rule.device === newTimer.device && rule.time === newTimer.time,
    );
    if (exists) {
      setTimerMessage({ type: "error", text: "新增失败：同一设备在同一时间已存在规则" });
      window.setTimeout(() => setTimerMessage(null), 2600);
      return;
    }

    const newRule: TimerRule = {
      id: `T-${Date.now()}`,
      ...newTimer,
      status: "启用",
    };
    setTimers((prev) => [...prev, newRule]);
    setShowAddTimer(false);
    setTimerMessage({ type: "success", text: "新增成功" });
    window.setTimeout(() => setTimerMessage(null), 2200);
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
          {/* Greenhouse Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">大棚选择：</span>
            {["1号大棚", "2号大棚", "3号大棚"].map((gh) => (
              <button
                key={gh}
                onClick={() => setSelectedGH(gh)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedGH === gh
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
                }`}
              >
                {gh}
              </button>
            ))}
          </div>

          {/* MQTT Flow Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
            <div className="text-blue-500">📡</div>
            
          </div>

          {/* Device Cards */}
          <div className="grid grid-cols-4 gap-4">
            {filteredDevices.map((device) => {
              const colors = colorMap[device.color] || colorMap.blue;
              return (
                <div key={device.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
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
                  <div className="text-xs text-gray-400 mb-3">{device.id} · {device.type}</div>

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
                      onClick={() => handleToggle(device.id)}
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
                    <div className="mt-2 text-xs text-green-600 bg-green-50 rounded-lg px-2 py-1">
                      ✓ {device.feedback}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredDevices.length === 0 && (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Power className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">该大棚暂无设备</p>
            </div>
          )}
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
              农户配置定时规则 → 后端调度中心扫描执行时间点 → 自动批量下发开启/关闭指令 → 系统记录执行状态
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">补光灯定时规则列表</h3>
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
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">设备</label>
                  <select
                    value={newTimer.device}
                    onChange={(e) => setNewTimer((p) => ({ ...p, device: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    {["补光灯 A区", "补光灯 B区", "灌溉水泵", "通风风机 #1"].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">动作</label>
                  <select
                    value={newTimer.action}
                    onChange={(e) => setNewTimer((p) => ({ ...p, action: e.target.value as "开启" | "关闭" }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    <option>开启</option>
                    <option>关闭</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">执行时间</label>
                  <input
                    type="time"
                    value={newTimer.time}
                    onChange={(e) => setNewTimer((p) => ({ ...p, time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">重复</label>
                  <select
                    value={newTimer.repeat}
                    onChange={(e) => setNewTimer((p) => ({ ...p, repeat: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    {["每天", "工作日", "周末", "周一三五", "仅一次"].map((r) => (
                      <option key={r}>{r}</option>
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
                  {["规则ID", "设备", "动作", "执行时间", "重复周期", "状态", "执行记录", "操作"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {timers.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{rule.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{rule.device}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rule.action === "开启" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
                      }`}>
                        {rule.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{rule.time}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{rule.repeat}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setTimers((prev) =>
                          prev.map((r) => r.id === rule.id ? { ...r, status: r.status === "启用" ? "禁用" : "启用" } : r)
                        )}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                          rule.status === "启用" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {rule.status}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {rule.status === "启用" ? "上次执行: 今天 " + rule.time : "未执行"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setTimers((prev) => prev.filter((r) => r.id !== rule.id))}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
