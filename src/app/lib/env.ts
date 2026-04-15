const trimSlash = (value: string) => value.replace(/\/$/, "");

const API_BASE = trimSlash(
  import.meta.env.VITE_API_BASE_URL || "",
);
const WS_BASE = trimSlash(import.meta.env.VITE_WS_BASE_URL || "");

export const env = {
  apiBase: API_BASE,
  wsBase: WS_BASE,
};

export function withApiBase(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${env.apiBase}${path}`;
}

export function withWsBase(path: string) {
  if (!env.wsBase) {
    return "";
  }
  if (path.startsWith("ws://") || path.startsWith("wss://")) {
    return path;
  }
  return `${env.wsBase}${path}`;
}
