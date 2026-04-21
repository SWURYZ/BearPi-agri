/**
 * 语音工具模块 —— 封装浏览器原生 TTS (SpeechSynthesis) 能力
 */

/** 是否支持 TTS */
export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 停止当前朗读 */
export function stopSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}

/** 是否正在朗读 */
export function isSpeaking(): boolean {
  return isTTSSupported() && window.speechSynthesis.speaking;
}

/**
 * 朗读文本（中文语音）。
 * 自动清理 Markdown 标记后朗读纯文本。
 * 返回 Promise，朗读结束后 resolve。
 */
export function speak(text: string, rate = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (!isTTSSupported() || !text.trim()) {
      resolve();
      return;
    }
    // 停止上一次播报
    window.speechSynthesis.cancel();

    const cleaned = stripMarkdown(text);
    if (!cleaned.trim()) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "zh-CN";
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // 声音选择优先级（与芽芽 pickYayaVoice 一致）：
    // 1. Microsoft Natural/Online 神经网络声音（接近真人）
    // 2. Xiaoxiao / Xiaoyi 女声
    // 3. 非男声回退
    // 4. 任意中文
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.filter((v) => v.lang.startsWith("zh"));
    const zhVoice =
      zh.find((v) => /natural|online/i.test(v.name) && /xiaoxiao|xiaoyi|xiaomeng|xiaochen/i.test(v.name)) ??
      zh.find((v) => /natural|online/i.test(v.name) && !/yunxi|yunyang|yunfeng|yunhao/i.test(v.name)) ??
      zh.find((v) => /xiaoxiao|xiaoyi/i.test(v.name)) ??
      zh.find((v) => !/male|yunxi|yunyang|yunfeng|yunhao/i.test(v.name)) ??
      zh[0];
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

/** 清除 Markdown 标记，返回纯文本 */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")          // 代码块
    .replace(/\*\*(.+?)\*\*/g, "$1")         // 粗体
    .replace(/\*(.+?)\*/g, "$1")             // 斜体
    .replace(/`(.+?)`/g, "$1")               // 行内代码
    .replace(/^#{1,6}\s+/gm, "")             // 标题
    .replace(/^[-*]\s+/gm, "")               // 列表
    .replace(/^\d+\.\s+/gm, "")              // 有序列表
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接
    .replace(/[🌡️💧☀️🌿🌱💡📄]/g, "")       // emoji
    .replace(/\n{2,}/g, "。")                 // 多换行
    .replace(/\n/g, "，")                     // 单换行
    .trim();
}
