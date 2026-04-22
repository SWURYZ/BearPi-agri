import { useEffect, useState } from "react";
import { ClipboardList, Monitor, ScanFace, RefreshCw, UserPlus } from "lucide-react";
import { getLoginLogs, type LoginLog } from "../services/auth";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LoginLogs() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLoginLogs();
      setLogs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "获取日志失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 to-green-50/30 p-6 overflow-y-auto">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-green-600" />
            登录日志
          </h1>
          <p className="text-sm text-gray-500 mt-1">记录所有用户的登录行为及时间</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-800">{logs.length}</div>
          <div className="text-xs text-gray-500 mt-1">总记录数</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {logs.filter((l) => l.loginType === "password").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">密码登录</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-bold text-violet-600">
            {logs.filter((l) => l.loginType === "face").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">人脸登录</div>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">登录记录（最新在前）</h2>
        </div>

        {error ? (
          <div className="p-10 text-center text-sm text-red-500">{error}</div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-gray-400">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">暂无登录记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-xs text-gray-500 uppercase">
                  <th className="px-5 py-3 text-left font-medium">#</th>
                  <th className="px-5 py-3 text-left font-medium">用户名</th>
                  <th className="px-5 py-3 text-left font-medium">姓名</th>
                  <th className="px-5 py-3 text-left font-medium">操作类型</th>
                  <th className="px-5 py-3 text-left font-medium">客户端 IP</th>
                  <th className="px-5 py-3 text-left font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log, i) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-800">@{log.username}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{log.displayName || "—"}</td>
                    <td className="px-5 py-3">
                      {log.loginType === "face" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full font-medium">
                          <ScanFace className="w-3.5 h-3.5" />
                          人脸识别
                        </span>
                      ) : log.loginType === "register" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                          <UserPlus className="w-3.5 h-3.5" />
                          首次注册
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                          <Monitor className="w-3.5 h-3.5" />
                          密码登录
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs font-mono">{log.clientIp || "—"}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatTime(log.loginTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
