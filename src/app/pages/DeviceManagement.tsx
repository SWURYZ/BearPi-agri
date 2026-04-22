import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cpu,
  QrCode,
  Trash2,
  Search,
  CheckCircle,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Camera,
  X,
} from "lucide-react";
import { SimpleModal } from "../components/ui/SimpleModal";
import {
  type DeviceMappingResponse,
  fetchAllConnectedDevices,
  scanBindDevice,
  unbindDevice,
} from "../services/greenhouseMonitor";

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

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  在线: { color: "text-green-600", icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
  离线: { color: "text-gray-400", icon: <WifiOff className="w-4 h-4 text-gray-400" /> },
  告警: { color: "text-yellow-600", icon: <AlertTriangle className="w-4 h-4 text-yellow-500" /> },
};

const typeColors: Record<string, string> = {
  传感器: "bg-blue-50 text-blue-600",
  执行器: "bg-green-50 text-green-600",
  网关: "bg-purple-50 text-purple-600",
};

function normalizeDeviceType(raw: string | null): string {
  if (!raw) return "传感器";
  const text = raw.toUpperCase();
  if (text.includes("ACTUATOR") || text.includes("MOTOR") || text.includes("LIGHT")) return "执行器";
  if (text.includes("GATEWAY")) return "网关";
  if (text.includes("SENSOR")) return "传感器";
  if (["传感器", "执行器", "网关"].includes(raw)) return raw;
  return "传感器";
}

function mapFromBackend(item: DeviceMappingResponse): Device {
  const type = normalizeDeviceType(item.deviceType);
  const online = item.status === "BOUND";
  const ghName = item.greenhouseCode && item.greenhouseCode.trim() ? item.greenhouseCode : "未分配";
  return {
    id: item.deviceId,
    name: item.deviceName || item.deviceId,
    type,
    gh: ghName,
    mac: "-",
    ip: "-",
    status: online ? "在线" : "离线",
    bindTime: item.boundAt ? item.boundAt.slice(0, 10) : "-",
    firmware: "-",
    signal: online ? 92 : 0,
  };
}

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
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [filterGH, setFilterGH] = useState("全部");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [filterType, setFilterType] = useState("全部");
  const [showBindModal, setShowBindModal] = useState(false);
  const [qrContent, setQrContent] = useState("");
  const [bindGreenhouseCode, setBindGreenhouseCode] = useState("1号大棚");
  const [scanHint, setScanHint] = useState("点击开启摄像头后扫码，或手动粘贴二维码内容");
  const [isLoading, setIsLoading] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [pendingUnbindId, setPendingUnbindId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      if (filterGH !== "全部" && d.gh !== filterGH) return false;
      if (filterStatus !== "全部" && d.status !== filterStatus) return false;
      if (filterType !== "全部" && d.type !== filterType) return false;
      if (search && !d.name.includes(search) && !d.id.includes(search)) return false;
      return true;
    });
  }, [devices, filterGH, filterStatus, filterType, search]);

  async function loadDevices() {
    setIsLoading(true);
    try {
      const rows = await fetchAllConnectedDevices();
      setDevices(rows.map(mapFromBackend));
    } catch (e) {
      console.error(e);
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
    return () => stopCamera();
  }, []);

  const onlineCount = devices.filter((d) => d.status === "在线").length;
  const offlineCount = devices.filter((d) => d.status === "离线").length;
  const alertCount = devices.filter((d) => d.status === "告警").length;
  const greenhouseOptions = ["全部", ...Array.from(new Set(devices.map((d) => d.gh)))];

  function stopCamera() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    scanningRef.current = false;
  }

  async function startCameraScan() {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setScanHint("当前浏览器不支持二维码识别，请手动粘贴二维码内容");
        return;
      }
      detectorRef.current = new Detector({ formats: ["qr_code"] });
      setScanHint("摄像头已开启，请对准二维码");

      timerRef.current = window.setInterval(async () => {
        if (scanningRef.current || !videoRef.current || !detectorRef.current) return;
        try {
          scanningRef.current = true;
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            setQrContent(codes[0].rawValue);
            setScanHint("扫码成功，点击“确认绑定”即可");
            stopCamera();
          }
        } catch {
          // keep scanning loop running
        } finally {
          scanningRef.current = false;
        }
      }, 500);
    } catch (e: any) {
      setScanHint(`摄像头打开失败: ${e?.message || "请检查浏览器权限"}`);
    }
  }

  async function bindDeviceFromScan() {
    if (!qrContent.trim()) {
      setScanHint("请先扫码或输入二维码内容");
      return;
    }
    setIsBinding(true);
    try {
      await scanBindDevice({ qrContent: qrContent.trim(), greenhouseCode: bindGreenhouseCode });
      setScanHint("绑定成功");
      setQrContent("");
      setBindGreenhouseCode("1号大棚");
      setShowBindModal(false);
      await loadDevices();
    } catch (e: any) {
      setScanHint(`绑定失败: ${e?.message || "请检查二维码内容"}`);
    } finally {
      setIsBinding(false);
    }
  }

  function requestUnbind(id: string) {
    setPendingUnbindId(id);
  }

  async function confirmUnbind() {
    if (!pendingUnbindId) return;
    try {
      await unbindDevice(pendingUnbindId);
      setPendingUnbindId(null);
      await loadDevices();
    } catch (e) {
      console.error(e);
      setPendingUnbindId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <SimpleModal
        open={Boolean(pendingUnbindId)}
        title="确认解绑设备"
        description={pendingUnbindId ? `确认解绑设备 ${pendingUnbindId}？` : ""}
        confirmText="确认解绑"
        cancelText="取消"
        onConfirm={confirmUnbind}
        onCancel={() => setPendingUnbindId(null)}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">设备管理</h1>
          <p className="text-sm text-gray-500 mt-1">按后端真实已绑定设备动态展示各大棚，不再使用本地写死数据</p>
        </div>
        <button
          onClick={() => setShowBindModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors shadow-sm"
        >
          <QrCode className="w-4 h-4" />
          扫码绑定新设备
        </button>
      </div>

      {showBindModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[460px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800">扫码绑定设备</h3>
                  <p className="text-xs text-gray-400">调用电脑摄像头扫描二维码并绑定到指定大棚</p>
                </div>
              </div>
              <button onClick={() => { stopCamera(); setShowBindModal(false); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-black mb-3">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-52 object-cover" />
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={startCameraScan}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                开启摄像头扫码
              </button>
              <button
                onClick={stopCamera}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                停止
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500 block">绑定到大棚</label>
              <select
                value={bindGreenhouseCode}
                onChange={(e) => setBindGreenhouseCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
              >
                {["1号大棚", "2号大棚", "3号大棚", "4号大棚", "5号大棚", "6号大棚"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <label className="text-xs text-gray-500 block">二维码内容</label>
              <input
                value={qrContent}
                onChange={(e) => setQrContent(e.target.value)}
                placeholder="支持 JSON / key=value / 直接deviceId"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
              />
              <p className="text-xs text-gray-500">{scanHint}</p>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { stopCamera(); setShowBindModal(false); }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={bindDeviceFromScan}
                disabled={isBinding}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
              >
                {isBinding ? "绑定中..." : "确认绑定"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              {greenhouseOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
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
          <button
            onClick={loadDevices}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[d.type] || typeColors["传感器"]}`}>
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
                    <button
                      onClick={loadDevices}
                      className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="刷新"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
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
            <p className="text-sm">{isLoading ? "加载中..." : "暂无已绑定设备，请先扫码绑定设备"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
