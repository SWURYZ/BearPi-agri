import { withApiBase } from "../lib/env";

export interface AgriAgentChatRequest {
  question: string;
  userId?: string;
  conversationId?: string;
  /** 可选：Coze 文件上传后返回的 file_id，用于多模态（图片）提问 */
  fileId?: string;
}

interface StreamEvent {
  event: string;
  data: string;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onThinking?: (token: string) => void;
  onContext?: (conversationId: string) => void;
  onDone?: (data: string) => void;
  onError?: (message: string) => void;
}

function parseSseBlock(block: string): StreamEvent | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0 && event === "message") {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

export async function streamAgriAgentChat(
  request: AgriAgentChatRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
) {
  const res = await fetch(withApiBase("/api/v1/agri-agent/chat/stream"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  });

  await consumeSseStream(res, callbacks);
}

/**
 * 带图片的多模态提问：前端直接 multipart 上传，后端完成"上传到 Coze → 取 file_id → 发起 chat"。
 */
export async function streamAgriAgentChatWithImage(
  params: {
    image: File;
    question: string;
    userId?: string;
    conversationId?: string;
  },
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
) {
  const form = new FormData();
  form.append("image", params.image);
  form.append("question", params.question);
  if (params.userId) form.append("userId", params.userId);
  if (params.conversationId) form.append("conversationId", params.conversationId);

  const res = await fetch(withApiBase("/api/v1/agri-agent/chat/stream/with-image"), {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: form,
    signal,
  });

  await consumeSseStream(res, callbacks);
}

async function consumeSseStream(res: Response, callbacks: StreamCallbacks) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `agri-agent stream request failed: ${res.status}`);
  }

  if (!res.body) {
    callbacks.onError?.("服务未返回流式数据");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let doneReceived = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let sepIndex = buffer.indexOf("\n\n");
    while (sepIndex >= 0) {
      const block = buffer.slice(0, sepIndex).trim();
      buffer = buffer.slice(sepIndex + 2);

      if (block) {
        const event = parseSseBlock(block);
        if (event) {
          if (event.event === "token") {
            callbacks.onToken(event.data);
          } else if (event.event === "thinking") {
            callbacks.onThinking?.(event.data);
          } else if (event.event === "context") {
            callbacks.onContext?.(event.data);
          } else if (event.event === "done") {
            doneReceived = true;
            callbacks.onDone?.(event.data);
          } else if (event.event === "error") {
            callbacks.onError?.(event.data || "智能助手服务异常");
          }
        }
      }

      sepIndex = buffer.indexOf("\n\n");
    }
  }

  const tail = decoder.decode();
  if (tail) {
    buffer += tail;
  }

  if (!doneReceived) {
    callbacks.onDone?.("[DONE]");
  }
}
