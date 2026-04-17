import { useState, useEffect } from "react";
import {
  Brain,
  Droplets,
  Sun,
  Wind,
  Thermometer,
  Bug,
  Flower2,
  Scissors,
  AlertTriangle,
  Send,
  Loader2,
  ChevronRight,
  Activity,
  Lightbulb,
  Fan,
} from "lucide-react";
import {
  executeDecision,
  getScenarios,
  type DecisionResponse,
  type ScenarioItem,
} from "../services/smartDecision";

const scenarioIcons: Record<string, React.ElementType> = {
  IRRIGATION: Droplets,
  LIGHT: Sun,
  VENTILATION: Wind,
  TEMPERATURE: Thermometer,
  PEST: Bug,
  FERTILIZATION: Flower2,
  HARVEST: Scissors,
  ANOMALY: AlertTriangle,
};

const scenarioColors: Record<string, string> = {
  IRRIGATION: "bg-blue-50 text-blue-600 border-blue-200",
  LIGHT: "bg-yellow-50 text-yellow-600 border-yellow-200",
  VENTILATION: "bg-cyan-50 text-cyan-600 border-cyan-200",
  TEMPERATURE: "bg-orange-50 text-orange-600 border-orange-200",
  PEST: "bg-red-50 text-red-600 border-red-200",
  FERTILIZATION: "bg-emerald-50 text-emerald-600 border-emerald-200",
  HARVEST: "bg-amber-50 text-amber-600 border-amber-200",
  ANOMALY: "bg-rose-50 text-rose-600 border-rose-200",
};

const scenarioBg: Record<string, string> = {
  IRRIGATION: "from-blue-500 to-blue-600",
  LIGHT: "from-yellow-500 to-yellow-600",
  VENTILATION: "from-cyan-500 to-cyan-600",
  TEMPERATURE: "from-orange-500 to-orange-600",
  PEST: "from-red-500 to-red-600",
  FERTILIZATION: "from-emerald-500 to-emerald-600",
  HARVEST: "from-amber-500 to-amber-600",
  ANOMALY: "from-rose-500 to-rose-600",
};

const quickQuestions: { label: string; query: string; scenario?: string }[] = [
  { label: "需要灌溉吗?", query: "当前大棚需要灌溉吗？请根据传感器数据分析", scenario: "IRRIGATION" },
  { label: "补光灯建议", query: "当前光照是否充足？需要开补光灯吗", scenario: "LIGHT" },
  { label: "是否需要通风", query: "大棚温湿度情况如何？需要开风扇通风吗", scenario: "VENTILATION" },
  { label: "温度是否正常", query: "当前大棚温度是否在适宜范围？需要调控吗", scenario: "TEMPERATURE" },
  { label: "病虫害风险", query: "当前环境条件是否有病虫害风险？请评估", scenario: "PEST" },
  { label: "施肥建议", query: "当前需要施肥吗？请给出施肥建议", scenario: "FERTILIZATION" },
  { label: "采收时机", query: "当前是不是最佳的采收时机？", scenario: "HARVEST" },
  { label: "异常检测", query: "请检查当前传感器数据是否存在异常", scenario: "ANOMALY" },
];

export function SmartDecision() {
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [history, setHistory] = useState<DecisionResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScenarios().then(setScenarios).catch(() => {});
  }, []);

  const handleDecide = async (q?: string, s?: string) => {
    const finalQuery = q || query;
    if (!finalQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await executeDecision({
        query: finalQuery,
        scenario: s || selectedScenario || undefined,
      });
      setResult(res);
      setHistory((prev) => [res, ...prev].slice(0, 10));
    } catch (err: any) {
      setError(err.message || "决策失败");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (item: (typeof quickQuestions)[0]) => {
    setQuery(item.query);
    setSelectedScenario(item.scenario || "");
    handleDecide(item.query, item.scenario);
  };

  const snap = result?.sensorSnapshot;

  return (
    <div className="p-6 space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">智控决策</h1>
            <p className="text-sm text-gray-500">基于 LangGraph 的 AI 智能决策引擎</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Activity className="w-3.5 h-3.5" />
          <span>8 个决策场景 · Coze LLM</span>
        </div>
      </div>

      {/* 场景卡片网格 */}
      <div className="grid grid-cols-4 gap-3">
        {(scenarios.length > 0 ? scenarios : quickQuestions.map((q) => ({ code: q.scenario || "", label: q.label.replace("?", "") }))).map((s) => {
          const Icon = scenarioIcons[s.code] || Brain;
          const colorClass = scenarioColors[s.code] || "bg-gray-50 text-gray-600 border-gray-200";
          const isSelected = selectedScenario === s.code;
          return (
            <button
              key={s.code}
              onClick={() => setSelectedScenario(isSelected ? "" : s.code)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-200 text-left ${
                isSelected
                  ? "ring-2 ring-purple-400 border-purple-300 bg-purple-50"
                  : colorClass + " hover:shadow-md"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* 输入区 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleDecide()}
            placeholder="描述你的农事问题，AI 将自动分类并给出专业决策建议…"
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={() => handleDecide()}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "分析中…" : "智能决策"}
          </button>
        </div>

        {/* 快捷问题 */}
        <div className="flex flex-wrap gap-2 mt-3">
          {quickQuestions.map((q) => (
            <button
              key={q.label}
              onClick={() => handleQuickQuestion(q)}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-gray-50 hover:bg-purple-50 text-gray-600 hover:text-purple-600 rounded-lg border border-gray-200 hover:border-purple-300 transition-all disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 决策结果 */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 结果头部 */}
          <div className={`bg-gradient-to-r ${scenarioBg[result.scenario] || "from-gray-500 to-gray-600"} p-5 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = scenarioIcons[result.scenario] || Brain;
                  return <Icon className="w-6 h-6" />;
                })()}
                <div>
                  <h3 className="text-lg font-semibold">{result.scenarioLabel}</h3>
                  <p className="text-sm opacity-80">场景代号：{result.scenario}</p>
                </div>
              </div>
              {result.graphTrace && (
                <div className="flex items-center gap-1 text-xs bg-white/20 px-3 py-1.5 rounded-lg">
                  <ChevronRight className="w-3 h-3" />
                  <span>工作流：{result.graphTrace}</span>
                </div>
              )}
            </div>
          </div>

          {/* 传感器快照 + 决策内容 */}
          <div className="p-5 space-y-4">
            {/* 传感器快照 */}
            {snap && snap.reportTime && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                  传感器数据快照
                </h4>
                <div className="grid grid-cols-5 gap-3">
                  <SensorCard
                    icon={Thermometer}
                    label="温度"
                    value={snap.temperature != null ? `${snap.temperature.toFixed(1)}°C` : "N/A"}
                    color="text-orange-500"
                  />
                  <SensorCard
                    icon={Droplets}
                    label="湿度"
                    value={snap.humidity != null ? `${snap.humidity.toFixed(1)}%` : "N/A"}
                    color="text-blue-500"
                  />
                  <SensorCard
                    icon={Sun}
                    label="光照"
                    value={snap.luminance != null ? `${Math.round(snap.luminance)} lux` : "N/A"}
                    color="text-yellow-500"
                  />
                  <SensorCard
                    icon={Lightbulb}
                    label="补光灯"
                    value={snap.ledStatus || "N/A"}
                    color="text-amber-500"
                  />
                  <SensorCard
                    icon={Fan}
                    label="风扇"
                    value={snap.motorStatus || "N/A"}
                    color="text-cyan-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">上报时间：{snap.reportTime}</p>
              </div>
            )}

            {/* 决策建议 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">AI 决策建议</h4>
              <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap leading-relaxed">
                {result.decision}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录 */}
      {history.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">历史决策记录</h3>
          <div className="space-y-2">
            {history.slice(1).map((h, i) => {
              const Icon = scenarioIcons[h.scenario] || Brain;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setResult(h)}
                >
                  <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-600">{h.scenarioLabel}</span>
                  <span className="text-xs text-gray-400 truncate flex-1">{h.decision.slice(0, 60)}…</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SensorCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-700 mt-0.5">{value}</p>
    </div>
  );
}
