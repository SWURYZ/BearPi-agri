import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Leaf,
  Thermometer,
  Droplets,
  Sun,
  Sparkles,
  RefreshCw,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Square,
} from "lucide-react";
import { streamAgriAgentChat } from "../services/agriAgent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: string[];
}

const currentData = {
  temp: 24.5,
  humidity: 68,
  light: 8500,
  co2: 420,
  soilHumidity: 45,
  gh: "1号大棚",
  crop: "番茄",
};

const suggestedQuestions = [
  "当前温度偏高，需要开启通风吗？",
  "番茄最适宜的温湿度范围是多少？",
  "今天光照强度是否适合番茄生长？",
  "如何判断土壤湿度是否需要灌溉？",
  "CO₂浓度对作物生长有什么影响？",
  "大棚温度骤降时应该怎么处理？",
];

function formatTime(date: Date) {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: `您好！我是**农事智能助手** 🌱\n\n我已读取 **${currentData.gh}** 的实时监测数据作为上下文，可以为您提供基于当前大棚环境的个性化种植建议。\n\n您可以问我：作物管理、病虫害防治、设备操作、环境调控等农业相关问题。`,
      timestamp: formatTime(new Date()),
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function appendAssistantText(assistantId: string, text: string) {
    if (!text) return;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? {
            ...msg,
            content: `${msg.content}${text}`,
          }
          : msg,
      ),
    );
  }

  function updateAssistantText(assistantId: string, text: string) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? {
            ...msg,
            content: text,
          }
          : msg,
      ),
    );
  }

  async function sendMessage(text?: string) {
    const content = text || input.trim();
    if (!content || loading) return;

    const now = Date.now();
    const userMsg: Message = {
      id: now.toString(),
      role: "user",
      content,
      timestamp: formatTime(new Date()),
    };

    const assistantId = `${now + 1}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: formatTime(new Date()),
      sources: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);
    setActiveAssistantId(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAgriAgentChat(
        {
          question: content,
          userId: "agri-web-ui",
        },
        {
          onToken: (token) => {
            appendAssistantText(assistantId, token);
          },
          onError: (message) => {
            updateAssistantText(assistantId, `服务异常：${message || "请稍后重试"}`);
          },
        },
        controller.signal,
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId && !msg.content.trim()
            ? { ...msg, content: "已连接到智能助手，但本次未返回有效内容。" }
            : msg,
        ),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId && !msg.content.trim()
              ? { ...msg, content: "已停止生成。" }
              : msg,
          ),
        );
      } else {
        const errText = error instanceof Error ? error.message : "网络请求失败";
        updateAssistantText(assistantId, `请求失败：${errText}`);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      setActiveAssistantId(null);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function renderContent(content: string) {
    return content
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-gray-800">{line.slice(2, -2)}</p>;
        }
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className={`${line.startsWith("-") ? "ml-3" : ""} leading-relaxed`}>
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
            )}
          </p>
        );
      });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">农事智能问答</h1>

          </div>
          <button
            onClick={() => setMessages((prev) => [prev[0]])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            清空对话
          </button>
        </div>

        {/* Context Bar */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">已加载上下文：{currentData.gh}实时数据</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { icon: Thermometer, label: "温度", value: `${currentData.temp}°C`, color: "text-orange-500" },
              { icon: Droplets, label: "湿度", value: `${currentData.humidity}%`, color: "text-blue-500" },
              { icon: Sun, label: "光照", value: `${currentData.light}lux`, color: "text-yellow-500" },
              { icon: Leaf, label: "作物", value: currentData.crop, color: "text-green-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                <span className="text-gray-400">{item.label}：</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RAG Pipeline */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          {["提问", "RAG检索知识库", "加载大棚数据", "AI生成建议", "个性化响应"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">{s}</span>
              {i < 4 && <span>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "bg-green-600" : "bg-blue-500"
                }`}
            >
              {msg.role === "assistant" ? (
                <Bot className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Bubble */}
            <div className={`max-w-2xl ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${msg.role === "user"
                    ? "bg-blue-500 text-white rounded-tr-md"
                    : "bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-md"
                  }`}
              >
                {msg.role === "assistant" ? (
                  <div className="space-y-1">{renderContent(msg.content)}</div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-gray-400">知识来源：</span>
                  {msg.sources.map((s) => (
                    <span key={s} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                      📄 {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className={`flex items-center gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <span className="text-xs text-gray-400">{msg.timestamp}</span>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1">
                    <button className="p-1 text-gray-300 hover:text-gray-500 rounded transition-colors" title="复制">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button className="p-1 text-gray-300 hover:text-green-500 rounded transition-colors" title="有帮助">
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors" title="没帮助">
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">AI正在分析大棚数据</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="px-6 mb-3">
          <p className="text-xs text-gray-400 mb-2">💡 常见问题：</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  void sendMessage(q);
                }}
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-full hover:border-green-400 hover:text-green-600 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-400 transition-colors shadow-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="请输入您的农事问题，如：当前大棚温度是否适合番茄生长？"
            className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
            disabled={loading}
          />
          <button
            onClick={() => {
              if (loading) {
                stopStreaming();
                return;
              }
              void sendMessage();
            }}
            disabled={!loading && !input.trim()}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${loading
                ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                : input.trim()
                  ? "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
          >
            {loading ? <Square className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {loading && activeAssistantId && (
          <p className="text-xs text-amber-600 text-center mt-2">正在流式生成中，点击右侧方块按钮可中断本次回答。</p>
        )}
        <p className="text-xs text-gray-400 text-center mt-2">
          AI建议仅供参考，请结合实际情况判断。数据来源：本地农业知识库 + 大棚实时传感数据
        </p>
      </div>
    </div>
  );
}
