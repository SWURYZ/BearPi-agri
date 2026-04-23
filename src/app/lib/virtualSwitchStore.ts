/**
 * 虚拟大棚设备开关 (灯/风机/灌溉) 的跨组件共享状态
 * - localStorage 持久化
 * - 同 tab 通过 CustomEvent 同步，多 tab 通过 storage 事件同步
 *
 * 注意：真实硬件 (1 号大棚) 的 LED/motor 走后端 API；
 * 这里的 store 只负责 **UI 可视状态** —— RealtimeMonitor 在真机上线时会用真实状态覆盖显示。
 */
import { useCallback, useEffect, useState } from "react";

export type VirtualSwitch = {
  led: boolean;
  motor: boolean;
  water: boolean;
};

const STORAGE_KEY = "bearpi-agri:virtual-switches-v1";
const EVENT_NAME = "bearpi-agri:virtual-switches-changed";

export type VirtualSwitchMap = Record<string, VirtualSwitch>;

function loadAll(): VirtualSwitchMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as VirtualSwitchMap;
  } catch {
    /* ignore */
  }
  return {};
}

function saveAll(map: VirtualSwitchMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getSwitch(name: string): VirtualSwitch {
  return loadAll()[name] ?? { led: false, motor: false, water: false };
}

/** 覆盖式更新单个大棚的开关；合并到已有 map */
export function setSwitch(name: string, patch: Partial<VirtualSwitch>) {
  const map = loadAll();
  const prev = map[name] ?? { led: false, motor: false, water: false };
  map[name] = { ...prev, ...patch };
  saveAll(map);
}

/** 批量设置多个大棚（合并） */
export function setSwitches(updates: Record<string, Partial<VirtualSwitch>>) {
  const map = loadAll();
  for (const [name, patch] of Object.entries(updates)) {
    const prev = map[name] ?? { led: false, motor: false, water: false };
    map[name] = { ...prev, ...patch };
  }
  saveAll(map);
}

/** React hook：订阅所有大棚开关状态 */
export function useVirtualSwitches(): [
  VirtualSwitchMap,
  (name: string, patch: Partial<VirtualSwitch>) => void,
] {
  const [map, setMap] = useState<VirtualSwitchMap>(loadAll);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMap(loadAll());
    };
    const onCustom = () => setMap(loadAll());
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom);
    };
  }, []);
  const update = useCallback(
    (name: string, patch: Partial<VirtualSwitch>) => {
      setSwitch(name, patch);
    },
    [],
  );
  return [map, update];
}
