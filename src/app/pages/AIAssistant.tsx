import { useState, useRef, useEffect, useCallback } from "react";
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
  Mic,
  MicOff,
  ImagePlus,
  X,
  ChevronDown,
  ChevronRight,
  Brain,
  Volume2,
  VolumeX,
} from "lucide-react";
import { streamAgriAgentChat } from "../services/agriAgent";
import { fetchRealtimeSnapshot } from "../services/realtime";
import { sendManualControl } from "../services/deviceControl";
import { speak, stopSpeaking, isTTSSupported } from "../lib/speech";
import { getCurrentUser } from "../services/auth";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking: string;
  timestamp: string;
  sources?: string[];
  imagePreview?: string;
}

interface GreenhouseData {
  temp: number;
  humidity: number;
  light: number;
  gh: string;
}

const defaultData: GreenhouseData = {
  temp: 0,
  humidity: 0,
  light: 0,
  gh: "1号大棚",
};

const suggestedQuestions = [
  "\u5f53\u524d\u6e29\u5ea6\u504f\u9ad8\uff0c\u9700\u8981\u5f00\u542f\u901a\u98ce\u5417\uff1f",
  "\u756a\u8304\u6700\u9002\u5b9c\u7684\u6e29\u6e7f\u5ea6\u8303\u56f4\u662f\u591a\u5c11\uff1f",
  "\u4eca\u5929\u5149\u7167\u5f3a\u5ea6\u662f\u5426\u9002\u5408\u756a\u8304\u751f\u957f\uff1f",
  "\u5982\u4f55\u5224\u65ad\u571f\u58e4\u6e7f\u5ea6\u662f\u5426\u9700\u8981\u704c\u6e89\uff1f",
  "CO\u2082\u6d53\u5ea6\u5bf9\u4f5c\u7269\u751f\u957f\u6709\u4ec0\u4e48\u5f71\u54cd\uff1f",
  "\u5927\u68da\u6e29\u5ea6\u9aa4\u964d\u65f6\u5e94\u8be5\u600e\u4e48\u5904\u7406\uff1f",
];

function formatTime(date: Date) {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function extractUserName(text: string): string | null {
  const patterns = [
    /我叫\s*([^\s，。！？,.!?\n]{1,20})/,
    /我的名字是\s*([^\s，。！？,.!?\n]{1,20})/,
    /叫我\s*([^\s，。！？,.!?\n]{1,20})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function asksGreetingFirst(text: string): boolean {
  return /(先.*(打招呼|问候)|回答前.*(打招呼|问候)|先跟我打个招呼|先给我打个招呼|记得先问候我)/.test(text);
}

function findRememberedNameFromMessages(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") {
      continue;
    }
    const detected = extractUserName(msg.content || "");
    if (detected) {
      return detected;
    }
  }
  return null;
}

function findGreetingRuleFromMessages(messages: Message[]): boolean {
  return messages.some((msg) => msg.role === "user" && asksGreetingFirst(msg.content || ""));
}

function buildQuestionWithMemory(question: string, userName: string | null, greetingFirst: boolean): string {
  const directives: string[] = [];

  if (userName) {
    directives.push(`用户姓名是${userName}`);
  }
  if (greetingFirst) {
    directives.push(userName
      ? `回答前先简短问候并称呼“${userName}”`
      : "回答前先简短问候用户");
  }

  if (directives.length === 0) {
    return question;
  }

  return `【会话记忆】${directives.join("；")}。请严格遵守。\n\n用户问题：${question}`;
}

function buildRecentDialogueContext(messages: Message[], currentQuestion: string): string {
  const history = messages
    .filter((msg) => msg.id !== "0")
    .slice(-8)
    .map((msg) => {
      const role = msg.role === "user" ? "用户" : "助手";
      const content = (msg.content || "").replace(/\s+/g, " ").trim();
      if (!content) return null;
      const shortText = content.length > 120 ? content.slice(0, 120) + "..." : content;
      return `${role}：${shortText}`;
    })
    .filter(Boolean) as string[];

  if (history.length === 0) {
    return currentQuestion;
  }

  return `【最近对话上下文】\n${history.join("\n")}\n\n【当前问题】${currentQuestion}`;
}

/* --- Markdown renderer --- */
function renderMarkdown(content: string) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre key={elements.length} className="bg-gray-900 text-green-300 rounded-lg p-3 my-2 text-xs overflow-x-auto">
          {lang && <div className="text-gray-500 text-[10px] mb-1">{lang}</div>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Headings - skip bare ### lines (noise from Coze)
    if (line.trim() === "###" || line.trim() === "##" || line.trim() === "#") {
      i++; continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<h4 key={elements.length} className="font-semibold text-gray-800 text-sm mt-3 mb-1">{renderInline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h3 key={elements.length} className="font-bold text-gray-800 mt-2 mb-1">{renderInline(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h2 key={elements.length} className="font-bold text-gray-900 text-lg mt-2 mb-1">{renderInline(line.slice(2))}</h2>);
      i++; continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={elements.length} className="list-decimal list-inside space-y-0.5 my-1 ml-1">
          {items.map((item, idx) => <li key={idx} className="leading-relaxed text-sm">{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Unordered list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={elements.length} className="list-disc list-inside space-y-0.5 my-1 ml-1">
          {items.map((item, idx) => <li key={idx} className="leading-relaxed text-sm">{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={elements.length} className="h-1" />);
      i++; continue;
    }

    // Normal paragraph
    elements.push(<p key={elements.length} className="leading-relaxed text-sm">{renderInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): (string | React.JSX.Element)[] {
  const parts: (string | React.JSX.Element)[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={`b${match.index}`} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<code key={`c${match.index}`} className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded text-xs">{match[4]}</code>);
    } else if (match[5]) {
      parts.push(<em key={`i${match.index}`}>{match[6]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/* --- Thinking Block (ChatGPT style) --- */
function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const thinkingEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll thinking area during streaming
  useEffect(() => {
    if (isStreaming && thinkingEndRef.current) {
      thinkingEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [content, isStreaming]);

  // Auto-collapse when streaming ends and there is content
  useEffect(() => {
    if (!isStreaming && content) {
      setCollapsed(true);
    }
  }, [isStreaming, content]);

  if (!content && !isStreaming) return null;

  const showBody = !collapsed;

  return (
    <div className="mb-3 border border-purple-200 rounded-xl overflow-hidden bg-gradient-to-b from-purple-50 to-white">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-purple-700 hover:bg-purple-100/40 transition-colors"
      >
        <Brain className={"w-4 h-4 " + (isStreaming ? "animate-pulse text-purple-500" : "text-purple-400")} />
        <span className="font-semibold">{isStreaming ? "\u6b63\u5728\u601d\u8003..." : "\u601d\u8003\u5b8c\u6210"}</span>
        {isStreaming && (
          <div className="flex gap-0.5 ml-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: i * 0.2 + "s" }} />
            ))}
          </div>
        )}
        <span className="ml-auto text-purple-400">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {showBody && (
        <div className="px-3 pb-3 border-t border-purple-100 max-h-72 overflow-y-auto">
          <div className="text-xs text-purple-600/80 leading-relaxed whitespace-pre-wrap pt-2">
            {content || "\u601d\u8003\u4e2d..."}
            {isStreaming && <span className="inline-block w-1 h-3 bg-purple-400 ml-0.5 animate-pulse" />}
            <div ref={thinkingEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Speech Recognition Hook --- */
function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof Object> | null>(null);

  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) onResult(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [supported, onResult]);

  const stop = useCallback(() => {
    if (recognitionRef.current && typeof (recognitionRef.current as Record<string, unknown>).stop === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any).stop();
    }
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}

/* --- Main Component --- */
export function AIAssistant() {
  const [currentData, setCurrentData] = useState<GreenhouseData>(defaultData);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});

  // Fetch real-time greenhouse data on mount and every 30s
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const metrics = await fetchRealtimeSnapshot("1号大棚");
        if (!cancelled) {
          setCurrentData((prev) => ({
            ...prev,
            temp: metrics.temp ?? prev.temp,
            humidity: metrics.humidity ?? prev.humidity,
            light: metrics.light ?? prev.light,
          }));
        }
      } catch {
        // keep previous data on error
      }
    }
    load();
    const timer = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  function buildWelcome(userName: string | null, data: GreenhouseData) {
    const greeting = userName ? `**${userName}**，您好！` : "您好！";
    return [
      `${greeting}我是**农事智能助手** 🌱`,
      "",
      `我已读取 **${data.gh}** 的实时监测数据作为上下文，可以为您提供基于当前大棚环境的个性化种植建议。`,
      "",
      "您可以问我：作物管理、病虫害防治、设备操作、环境调控等农业相关问题。",
    ].join("\n");
  }

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: buildWelcome(null, defaultData),
      thinking: "",
      timestamp: formatTime(new Date()),
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [rememberedUserName, setRememberedUserName] = useState<string | null>(null);
  const [mustGreetFirst, setMustGreetFirst] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ file: File; preview: string } | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Update welcome message when real data or user changes
  useEffect(() => {
    const updatedWelcome = buildWelcome(rememberedUserName, currentData);
    setMessages((prev) =>
      prev.map((msg) => (msg.id === "0" ? { ...msg, content: updatedWelcome } : msg)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData, rememberedUserName]);
  const [voiceMode, setVoiceMode] = useState(false); // 语音对话模式：识别后自动发送
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTtsRef = useRef<string | null>(null);

  // 自动从登录状态获取当前用户
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        setRememberedUserName(user.displayName || user.username);
        setMustGreetFirst(true);
      }
    });
  }, []);



  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageRef = useRef<(text?: string) => Promise<void>>(async () => { });

  const { listening, supported: speechSupported, start: startListening, stop: stopListening } =
    useSpeechRecognition(useCallback((text: string) => {
      setInput(text);
      // 语音对话模式下自动发送
      setTimeout(() => sendMessageRef.current(text), 100);
    }, []));

  function appendField(assistantId: string, field: "content" | "thinking", text: string) {
    if (!text) return;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, [field]: msg[field] + text }
          : msg,
      ),
    );
  }

  function updateField(assistantId: string, field: "content" | "thinking", text: string) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId ? { ...msg, [field]: text } : msg,
      ),
    );
  }

  /** 解析语音指令中的设备控制命令 */
  function parseDeviceCommand(text: string): { commandType: string; action: string; label: string } | null {
    const t = text.replace(/\s+/g, "");
    // 补光灯
    if (/(开|打开|开启|启动)(补光灯|灯|灯光)/.test(t)) return { commandType: "LIGHT_CONTROL", action: "ON", label: "补光灯开启" };
    if (/(关|关闭|关掉|熄灭)(补光灯|灯|灯光)/.test(t)) return { commandType: "LIGHT_CONTROL", action: "OFF", label: "补光灯关闭" };
    // 风扇/转机/电机
    if (/(开|打开|开启|启动)(风扇|转机|电机|马达|通风)/.test(t)) return { commandType: "MOTOR_CONTROL", action: "ON", label: "风扇开启" };
    if (/(关|关闭|关掉|停止)(风扇|转机|电机|马达|通风)/.test(t)) return { commandType: "MOTOR_CONTROL", action: "OFF", label: "风扇关闭" };
    return null;
  }

  /** 执行设备控制命令（语音触发） */
  async function executeVoiceDeviceCommand(cmd: { commandType: string; action: string; label: string }) {
    const now = Date.now();
    const userMsg: Message = {
      id: now.toString(),
      role: "user",
      content: `语音指令：${cmd.label}`,
      thinking: "",
      timestamp: formatTime(new Date()),
    };
    const assistantId = (now + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      thinking: "",
      timestamp: formatTime(new Date()),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const result = await sendManualControl({
        deviceId: "69d75b1d7f2e6c302f654fea_20031104",
        commandType: cmd.commandType,
        action: cmd.action,
      });
      const successText = `✅ ${cmd.label}指令已发送成功！\n\n- 请求ID：${result.requestId}\n- 状态：${result.status}\n- ${result.message}`;
      updateField(assistantId, "content", successText);
      if (ttsEnabled) speak(`${cmd.label}指令已发送成功`);
    } catch (err) {
      const errText = `❌ ${cmd.label}指令发送失败：${err instanceof Error ? err.message : "未知错误"}`;
      updateField(assistantId, "content", errText);
      if (ttsEnabled) speak(`${cmd.label}指令发送失败`);
    }
  }

  async function sendMessage(text?: string) {
    const content = text || input.trim();
    if (!content || loading) return;

    // 语音设备控制指令检测
    const deviceCmd = parseDeviceCommand(content);
    if (deviceCmd) {
      setInput("");
      await executeVoiceDeviceCommand(deviceCmd);
      // 语音模式下自动重新开始监听
      if (voiceMode && speechSupported) setTimeout(() => startListening(), 500);
      return;
    }

    const now = Date.now();
    const userMsg: Message = {
      id: now.toString(),
      role: "user",
      content,
      thinking: "",
      timestamp: formatTime(new Date()),
      imagePreview: selectedImage?.preview,
    };

    const assistantId = (now + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      thinking: "",
      timestamp: formatTime(new Date()),
      sources: [],
    };

    const detectedName = extractUserName(content);
    const rememberedFromHistory = findRememberedNameFromMessages(messages);
    const nextRememberedName = detectedName || rememberedUserName || rememberedFromHistory;
    const nextMustGreetFirst = mustGreetFirst || asksGreetingFirst(content) || findGreetingRuleFromMessages(messages);

    if (!rememberedUserName && rememberedFromHistory) {
      setRememberedUserName(rememberedFromHistory);
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSelectedImage(null);
    setLoading(true);
    setActiveAssistantId(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;

    const questionText = selectedImage
      ? "[\u7528\u6237\u4e0a\u4f20\u4e86\u4e00\u5f20\u56fe\u7247]\n" + content
      : content;

    if (detectedName && detectedName !== rememberedUserName) {
      setRememberedUserName(detectedName);
    }
    if (nextMustGreetFirst !== mustGreetFirst) {
      setMustGreetFirst(nextMustGreetFirst);
    }

    const memoryAwareQuestion = buildQuestionWithMemory(questionText, nextRememberedName, nextMustGreetFirst);
    const enrichedQuestion = buildRecentDialogueContext(messages, memoryAwareQuestion);

    try {
      await streamAgriAgentChat(
        {
          question: enrichedQuestion,
          userId: "agri-web-ui",
          conversationId: conversationId ?? undefined,
        },
        {
          onToken: (token) => {
            // Strip ### noise lines from Coze output
            const cleaned = token.replace(/^###\s*$/gm, "").replace(/^###\s*\n/gm, "");
            if (cleaned) appendField(assistantId, "content", cleaned);
          },
          onThinking: (token) => {
            appendField(assistantId, "thinking", token);
          },
          onContext: (id) => {
            const trimmed = id?.trim();
            if (trimmed) {
              setConversationId(trimmed);
            }
          },
          onError: (message) => {
            updateField(assistantId, "content", "\u670d\u52a1\u5f02\u5e38\uff1a" + (message || "\u8bf7\u7a0d\u540e\u91cd\u8bd5"));
          },
        },
        controller.signal,
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId && !msg.content.trim()
            ? { ...msg, content: "\u5df2\u8fde\u63a5\u5230\u667a\u80fd\u52a9\u624b\uff0c\u4f46\u672c\u6b21\u672a\u8fd4\u56de\u6709\u6548\u5185\u5bb9\u3002" }
            : msg,
        ),
      );
      // 流式结束后记录待朗读ID
      pendingTtsRef.current = assistantId;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId && !msg.content.trim()
              ? { ...msg, content: "\u5df2\u505c\u6b62\u751f\u6210\u3002" }
              : msg,
          ),
        );
      } else {
        const errText = error instanceof Error ? error.message : "\u7f51\u7edc\u8bf7\u6c42\u5931\u8d25";
        updateField(assistantId, "content", "\u8bf7\u6c42\u5931\u8d25\uff1a" + errText);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      setActiveAssistantId(null);
      // TTS 朗读完成的回复
      if (ttsEnabled && pendingTtsRef.current) {
        const ttsId = pendingTtsRef.current;
        pendingTtsRef.current = null;
        setMessages((prev) => {
          const target = prev.find((m) => m.id === ttsId);
          if (target?.content) {
            speak(target.content).then(() => {
              // 语音模式下朗读完毕自动开始下一轮监听
              if (voiceMode && speechSupported) startListening();
            });
          }
          return prev;
        });
      } else if (voiceMode && speechSupported) {
        // TTS 关闭但语音模式下仍重新监听
        setTimeout(() => startListening(), 500);
      }
    }
  }

  // 保持 sendMessageRef 同步
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return;
    const preview = URL.createObjectURL(file);
    setSelectedImage({ file, preview });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function copyToClipboard(messageId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedMessageId(messageId);
    window.setTimeout(() => {
      setCopiedMessageId((prev) => (prev === messageId ? null : prev));
    }, 1200);
  }

  function setFeedback(messageId: string, next: "up" | "down") {
    setFeedbackMap((prev) => {
      const current = prev[messageId];
      if (current === next) {
        const { [messageId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [messageId]: next };
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{"\u519c\u4e8b\u667a\u80fd\u95ee\u7b54"}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 语音播报开关 */}
            {isTTSSupported() && (
              <button
                onClick={() => { setTtsEnabled((v) => !v); if (ttsEnabled) stopSpeaking(); }}
                className={"flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors " + (ttsEnabled ? "text-green-600 border-green-300 bg-green-50" : "text-gray-500 border-gray-200 hover:bg-gray-50")}
                title={ttsEnabled ? "关闭语音播报" : "开启语音播报"}
              >
                {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                {"语音播报"}
              </button>
            )}
            {/* 语音对话模式 */}
            {speechSupported && (
              <button
                onClick={() => {
                  const next = !voiceMode;
                  setVoiceMode(next);
                  if (next) { setTtsEnabled(true); startListening(); }
                  else { stopListening(); stopSpeaking(); }
                }}
                className={"flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors " + (voiceMode ? "text-blue-600 border-blue-300 bg-blue-50 animate-pulse" : "text-gray-500 border-gray-200 hover:bg-gray-50")}
                title={voiceMode ? "退出语音对话" : "语音对话模式"}
              >
                {voiceMode ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                {"语音对话"}
              </button>
            )}
            <button
              onClick={() => {
                setMessages((prev) => [prev[0]]);
                setConversationId(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {"\u6e05\u7a7a\u5bf9\u8bdd"}
            </button>
          </div>
        </div>

        {/* Context Bar */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">{"\u5df2\u52a0\u8f7d\u4e0a\u4e0b\u6587\uff1a" + currentData.gh + "\u5b9e\u65f6\u6570\u636e"}</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { icon: Thermometer, label: "\u6e29\u5ea6", value: currentData.temp + "\u00b0C", color: "text-orange-500" },
              { icon: Droplets, label: "\u6e7f\u5ea6", value: currentData.humidity + "%", color: "text-blue-500" },
              { icon: Sun, label: "\u5149\u7167", value: currentData.light + "lux", color: "text-yellow-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <item.icon className={"w-3.5 h-3.5 " + item.color} />
                <span className="text-gray-400">{item.label + "\uff1a"}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RAG Pipeline */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          {["\u63d0\u95ee", "RAG\u68c0\u7d22\u77e5\u8bc6\u5e93", "\u52a0\u8f7d\u5927\u68da\u6570\u636e", "AI\u751f\u6210\u5efa\u8bae", "\u4e2a\u6027\u5316\u54cd\u5e94"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">{s}</span>
              {i < 4 && <span>{"\u2192"}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={"flex gap-3 " + (msg.role === "user" ? "flex-row-reverse" : "")}>
            {/* Avatar */}
            <div
              className={"w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 " + (msg.role === "assistant" ? "bg-green-600" : "bg-blue-500")}
            >
              {msg.role === "assistant" ? (
                <Bot className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Bubble */}
            <div className={"max-w-2xl " + (msg.role === "user" ? "items-end" : "items-start") + " flex flex-col gap-1"}>
              {/* User image preview */}
              {msg.role === "user" && msg.imagePreview && (
                <div className="rounded-xl overflow-hidden border border-blue-200 mb-1">
                  <img src={msg.imagePreview} alt="upload" className="max-w-xs max-h-40 object-cover" />
                </div>
              )}

              <div
                className={"rounded-2xl px-4 py-3 text-sm " + (msg.role === "user"
                  ? "bg-blue-500 text-white rounded-tr-md"
                  : "bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-md"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="space-y-1">
                    <ThinkingBlock
                      content={msg.thinking}
                      isStreaming={loading && msg.id === activeAssistantId && !msg.content}
                    />
                    {renderMarkdown(msg.content)}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-gray-400">{"\u77e5\u8bc6\u6765\u6e90\uff1a"}</span>
                  {msg.sources.map((s) => (
                    <span key={s} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                      {"\ud83d\udcc4 " + s}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className={"flex items-center gap-2 " + (msg.role === "user" ? "flex-row-reverse" : "")}>
                <span className="text-xs text-gray-400">{msg.timestamp}</span>
                {msg.role === "assistant" && msg.id !== "0" && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { void copyToClipboard(msg.id, msg.content); }}
                      className={"p-1 rounded transition-colors " + (copiedMessageId === msg.id
                        ? "text-green-600 bg-green-50"
                        : "text-gray-300 hover:text-gray-500")}
                      title={copiedMessageId === msg.id ? "copied" : "copy"}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setFeedback(msg.id, "up")}
                      className={"p-1 rounded transition-colors " + (feedbackMap[msg.id] === "up"
                        ? "text-green-600 bg-green-50"
                        : "text-gray-300 hover:text-green-500")}
                      title="helpful"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setFeedback(msg.id, "down")}
                      className={"p-1 rounded transition-colors " + (feedbackMap[msg.id] === "down"
                        ? "text-red-500 bg-red-50"
                        : "text-gray-300 hover:text-red-400")}
                      title="not helpful"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && activeAssistantId && (() => {
          const activeMsg = messages.find((m) => m.id === activeAssistantId);
          const hasContent = activeMsg && (activeMsg.content || activeMsg.thinking);
          if (hasContent) return null;
          return (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{"\u0041\u0049\u6b63\u5728\u5206\u6790\u5927\u68da\u6570\u636e"}</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"
                        style={{ animationDelay: i * 0.15 + "s" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div ref={bottomRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="px-4 md:px-6 mb-3">
          <p className="text-xs text-gray-400 mb-2">{"\ud83d\udca1 \u5e38\u89c1\u95ee\u9898\uff1a"}</p>
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
          {/* 语音指令提示 */}
          {speechSupported && (
            <div className="mt-2">
              <p className="text-xs text-gray-400 mb-1">{"\ud83c\udf99\ufe0f \u8bed\u97f3\u6307\u4ee4\u793a\u4f8b\uff1a"}</p>
              <div className="flex flex-wrap gap-2">
                {["\u5f00\u8865\u5149\u706f", "\u5173\u8865\u5149\u706f", "\u5f00\u98ce\u6247", "\u5173\u98ce\u6247"].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => void sendMessage(cmd)}
                    className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-full hover:border-blue-400 hover:text-blue-700 transition-all"
                  >
                    {"\ud83d\udce2 " + cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image preview bar */}
      {selectedImage && (
        <div className="px-4 md:px-6 mb-2">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <img src={selectedImage.preview} alt="preview" className="w-12 h-12 object-cover rounded-lg" />
            <span className="text-xs text-gray-500 max-w-[120px] truncate">{selectedImage.file.name}</span>
            <button
              onClick={() => { setSelectedImage(null); }}
              className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 md:px-6 pb-4 md:pb-6">
        <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-400 transition-colors shadow-sm">
          {/* Image upload */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-40"
            title="upload image"
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          {/* Voice input */}
          {speechSupported && (
            <button
              onClick={() => { listening ? stopListening() : startListening(); }}
              disabled={loading}
              className={"p-1.5 rounded-lg transition-colors disabled:opacity-40 " + (
                listening
                  ? "text-red-500 bg-red-50 animate-pulse"
                  : "text-gray-400 hover:text-green-600 hover:bg-green-50"
              )}
              title={listening ? "stop" : "voice input"}
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={listening ? "\u6b63\u5728\u542c\u60a8\u8bf4\u8bdd\u2026\u8bd5\u8bd5\u201c\u5f00\u8865\u5149\u706f\u201d\u201c\u5f53\u524d\u6e29\u5ea6\u591a\u5c11\u201d" : voiceMode ? "\u8bed\u97f3\u5bf9\u8bdd\u6a21\u5f0f\u5df2\u5f00\u542f\uff0c\u8bf7\u8bf4\u51fa\u60a8\u7684\u95ee\u9898\u6216\u6307\u4ee4" : "\u8bf7\u8f93\u5165\u60a8\u7684\u519c\u4e8b\u95ee\u9898\uff0c\u5982\uff1a\u5f53\u524d\u5927\u68da\u6e29\u5ea6\u662f\u5426\u9002\u5408\u756a\u8304\u751f\u957f\uff1f"}
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
            disabled={!loading && !input.trim() && !selectedImage}
            className={"w-9 h-9 rounded-xl flex items-center justify-center transition-all " + (loading
              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
              : input.trim() || selectedImage
                ? "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            )}
          >
            {loading ? <Square className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {loading && activeAssistantId && (
          <p className="text-xs text-amber-600 text-center mt-2">{"\u6b63\u5728\u6d41\u5f0f\u751f\u6210\u4e2d\uff0c\u70b9\u51fb\u53f3\u4fa7\u65b9\u5757\u6309\u94ae\u53ef\u4e2d\u65ad\u672c\u6b21\u56de\u7b54\u3002"}</p>
        )}
        <p className="text-xs text-gray-400 text-center mt-2">
          {"AI\u5efa\u8bae\u4ec5\u4f9b\u53c2\u8003\uff0c\u8bf7\u7ed3\u5408\u5b9e\u9645\u60c5\u51b5\u5224\u65ad\u3002\u6570\u636e\u6765\u6e90\uff1a\u672c\u5730\u519c\u4e1a\u77e5\u8bc6\u5e93 + \u5927\u68da\u5b9e\u65f6\u4f20\u611f\u6570\u636e"}
        </p>
      </div>
    </div>
  );
}
