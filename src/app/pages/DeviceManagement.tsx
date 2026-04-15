import { useState } from "react";
import {
  Cpu,
  Plus,
  QrCode,
  Trash2,
  Search,
  CheckCircle,
  WifiOff,
  AlertTriangle,
  Edit2,
  RefreshCw,
} from "lucide-react";
import { SimpleModal } from "../components/ui/SimpleModal";

interface Device {
  id: string;
  name: string;
  type: string;
  gh: string;
  mac: string;
  ip: string;
  status: "在线" | "离线" | "告警";
  bindTime: string;
  firmware: string;
  signal: number;
}

const initialDevices: Device[] = [
  { id: "DEV-GH01-T01", name: "温湿度传感器 #1", type: "传感器", gh: "1号大棚", mac: "AA:BB:CC:01:01", ip: "192.168.1.101", status: "在线", bindTime: "2026-01-15", firmware: "v2.1.3", signal: 92 },
  { id: "DEV-GH01-T02", name: "温湿度传感器 #2", type: "传感器", gh: "1号大棚", mac: "AA:BB:CC:01:02", ip: "192.168.1.102", status: "在线", bindTime: "2026-01-15", firmware: "v2.1.3", signal: 87 },
  { id: "DEV-GH01-F01", name: "通风风机 #1", type: "执行器", gh: "1号大棚", mac: "AA:BB:CC:01:11", ip: "192.168.1.111", status: "在线", bindTime: "2026-01-16", firmware: "v1.5.0", signal: 78 },
  { id: "DEV-GH01-F02", name: "通风风机 #2", type: "执行器", gh: "1号大棚", mac: "AA:BB:CC:01:12", ip: "192.168.1.112", status: "在线", bindTime: "2026-01-16", firmware: "v1.5.0", signal: 81 },
  { id: "DEV-GH01-L01", name: "光照传感器", type: "传感器", gh: "1号大棚", mac: "AA:BB:CC:01:21", ip: "192.168.1.121", status: "在线", bindTime: "2026-02-01", firmware: "v1.2.0", signal: 95 },
  { id: "DEV-GH02-T01", name: "温湿度传感器 #1", type: "传感器", gh: "2号大棚", mac: "AA:BB:CC:02:01", ip: "192.168.1.201", status: "告警", bindTime: "2026-01-20", firmware: "v2.1.3", signal: 65 },
  { id: "DEV-GH02-P01", name: "灌溉水泵", type: "执行器", gh: "2号大棚", mac: "AA:BB:CC:02:11", ip: "192.168.1.211", status: "在线", bindTime: "2026-01-20", firmware: "v2.0.1", signal: 73 },
  { id: "DEV-GH03-T01", name: "土壤传感器 #1", type: "传感器", gh: "3号大棚", mac: "AA:BB:CC:03:01", ip: "192.168.1.301", status: "在线", bindTime: "2026-02-10", firmware: "v1.8.2", signal: 88 },
  { id: "DEV-GH04-T01", name: "网关设备", type: "网关", gh: "4号大棚", mac: "AA:BB:CC:04:00", ip: "192.168.1.400", status: "离线", bindTime: "2026-03-01", firmware: "v3.0.0", signal: 0 },
  { id: "DEV-GH05-L01", name: "补光灯控制器", type: "执行器", gh: "5号大棚", mac: "AA:BB:CC:05:11", ip: "192.168.1.511", status: "在线", bindTime: "2026-02-28", firmware: "v1.1.0", signal: 90 },
];

const statusConfig: Record<string, { color: string; icon: React.ReactNode; badge: string }> = {
  在线: { color: "text-green-600", icon: <CheckCircle className="w-4 h-4 text-green-500" />, badge: "bg-green-100 text-green-600" },
  离线: { color: "text-gray-400", icon: <WifiOff className="w-4 h-4 text-gray-400" />, badge: "bg-gray-100 text-gray-400" },
  告警: { color: "text-yellow-600", icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, badge: "bg-yellow-100 text-yellow-600" },
};

const typeColors: Record<string, string> = {
  传感器: "bg-blue-50 text-blue-600",
  执行器: "bg-green-50 text-green-600",
  网关: "bg-purple-50 text-purple-600",
};

function SignalBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[25, 50, 75, 100].map((threshold, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm transition-all ${value >= threshold ? color : "bg-gray-200"}`}
          style={{ height: `${(i + 1) * 25}%` }}
        />
      ))}
    </div>
  );
}

export function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [search, setSearch] = useState("");
  const [filterGH, setFilterGH] = useState("全部");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [filterType, setFilterType] = useState("全部");
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindForm, setBindForm] = useState({ id: "", name: "", type: "传感器", gh: "1号大棚" });
  const [pendingUnbindId, setPendingUnbindId] = useState<string | null>(null);

  const filtered = devices.filter((d) => {
    if (filterGH !== "全部" && d.gh !== filterGH) return false;
    if (filterStatus !== "全部" && d.status !== filterStatus) return false;
    if (filterType !== "全部" && d.type !== filterType) return false;
    if (search && !d.name.includes(search) && !d.id.includes(search)) return false;
    return true;
  });

  function requestUnbind(id: string) {
    setPendingUnbindId(id);
  }

  function confirmUnbind() {
    if (!pendingUnbindId) {
      return;
    }
    setDevices((prev) => prev.filter((d) => d.id !== pendingUnbindId));
    setPendingUnbindId(null);
  }

  function bindDevice() {
    const now = new Date().toISOString().slice(0, 10);
    setDevices((prev) => [
      ...prev,
      {
        id: bindForm.id || `DEV-NEW-${Date.now()}`,
        name: bindForm.name || "新设备",
        type: bindForm.type,
        gh: bindForm.gh,
        mac: `AA:BB:CC:FF:${Math.floor(Math.random() * 99).toString(16).padStart(2, "0")}`,
        ip: `192.168.1.${Math.floor(Math.random() * 200 + 50)}`,
        status: "在线",
        bindTime: now,
        firmware: "v1.0.0",
        signal: Math.floor(Math.random() * 40 + 55),
      },
    ]);
    setShowBindModal(false);
    setBindForm({ id: "", name: "", type: "传感器", gh: "1号大棚" });
  }

  const onlineCount = devices.filter((d) => d.status === "在线").length;
  const offlineCount = devices.filter((d) => d.status === "离线").length;
  const alertCount = devices.filter((d) => d.status === "告警").length;

  return (
    <div className="p-6 space-y-5">
      <SimpleModal
        open={Boolean(pendingUnbindId)}
        title="确认解绑设备"
        description={pendingUnbindId ? `确认解绑设备 ${pendingUnbindId}？` : ""}
        confirmText="确认解绑"
        cancelText="取消"
        onConfirm={confirmUnbind}
        onCancel={() => setPendingUnbindId(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">设备管理</h1>
          
        </div>
        <button
          onClick={() => setShowBindModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors shadow-sm"
        >
          <QrCode className="w-4 h-4" />
          扫码绑定新设备
        </button>
      </div>

      {/* Bind Device Modal */}
      {showBindModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <QrCode className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">扫码绑定设备</h3>
                <p className="text-xs text-gray-400">扫描设备二维码或手动填写设备信息</p>
              </div>
            </div>

            {/* Mock QR Scanner */}
            <div className="border-2 border-dashed border-green-300 rounded-xl p-6 text-center mb-4 bg-green-50/50">
              <QrCode className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">将设备二维码对准此区域</p>
              <p className="text-xs text-gray-400 mt-1">或手动填写以下信息</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">设备ID</label>
                <input
                  value={bindForm.id}
                  onChange={(e) => setBindForm((p) => ({ ...p, id: e.target.value }))}
                  placeholder="如: DEV-GH01-T03"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">设备名称</label>
                <input
                  value={bindForm.name}
                  onChange={(e) => setBindForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="如: 温湿度传感器 #3"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">设备类型</label>
                  <select
                    value={bindForm.type}
                    onChange={(e) => setBindForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    <option>传感器</option>
                    <option>执行器</option>
                    <option>网关</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">所属大棚</label>
                  <select
                    value={bindForm.gh}
                    onChange={(e) => setBindForm((p) => ({ ...p, gh: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
                  >
                    {["1号大棚", "2号大棚", "3号大棚", "4号大棚", "5号大棚", "6号大棚"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowBindModal(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={bindDevice}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                确认绑定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "设备总数", value: devices.length, color: "gray", icon: "📡" },
          { label: "在线设备", value: onlineCount, color: "green", icon: "✅" },
          { label: "离线设备", value: offlineCount, color: "gray", icon: "⭕" },
          { label: "告警设备", value: alertCount, color: "yellow", icon: "⚠️" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-500">{c.label}</span>
              <span className="text-lg">{c.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${
              c.color === "green" ? "text-green-600" : c.color === "yellow" ? "text-yellow-600" : "text-gray-800"
            }`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索设备名称或ID..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">大棚：</span>
            <select
              value={filterGH}
              onChange={(e) => setFilterGH(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
            >
              {["全部", "1号大棚", "2号大棚", "3号大棚", "4号大棚", "5号大棚"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">状态：</span>
            {["全部", "在线", "离线", "告警"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">类型：</span>
            {["全部", "传感器", "执行器", "网关"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterType === t ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Device Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["设备ID", "设备名称", "类型", "所属大棚", "MAC地址", "IP地址", "固件版本", "信号强度", "绑定时间", "状态", "操作"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{d.id}</td>
                <td className="px-3 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{d.name}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[d.type]}`}>
                    {d.type}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{d.gh}</td>
                <td className="px-3 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{d.mac}</td>
                <td className="px-3 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{d.ip}</td>
                <td className="px-3 py-3 text-xs text-gray-500">{d.firmware}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <SignalBar value={d.signal} />
                    <span className="text-xs text-gray-500">{d.signal}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{d.bindTime}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {statusConfig[d.status].icon}
                    <span className={`text-xs font-medium ${statusConfig[d.status].color}`}>{d.status}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="刷新">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="编辑">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => requestUnbind(d.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="解绑"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Cpu className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无符合条件的设备</p>
          </div>
        )}
      </div>
    </div>
  );
}
