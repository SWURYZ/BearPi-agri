/**
 * 大棚清单 store — localStorage 持久化
 *
 * 约束:
 * - 1号大棚绑定真实硬件 (deviceId 69d75b1d7f2e6c302f654fea_20031104,
 *   greenhouseCode "GH-01"), 其名称固定、禁止删除.
 * - 其他大棚都是纯虚拟, 可新增、删除、改作物.
 * - 不允许重命名 (避免阈值规则/历史数据 orphan).
 * - 最大 12 个, 最少保留 1 号大棚.
 */
import { useCallback, useEffect, useState } from "react";

export interface GreenhouseItem {
  /** 大棚显示名 (唯一主键), 例如 "1号大棚" */
  name: string;
  /** 作物名, 例如 "番茄", 用于 3D/配色/卡片展示 */
  crop: string;
  /** 真实硬件绑定的大棚不可删除, 名称锁定 */
  locked: boolean;
}

export const MAX_GREENHOUSES = 12;
export const LOCKED_NAME = "1号大棚";
export const CROP_OPTIONS = ["番茄", "黄瓜", "草莓", "辣椒", "生菜", "茄子"] as const;

const STORAGE_KEY = "bearpi-agri:greenhouses-v1";

const DEFAULT_LIST: GreenhouseItem[] = [
  { name: "1号大棚", crop: "番茄", locked: true },
  { name: "2号大棚", crop: "黄瓜", locked: false },
  { name: "3号大棚", crop: "草莓", locked: false },
  { name: "4号大棚", crop: "辣椒", locked: false },
  { name: "5号大棚", crop: "生菜", locked: false },
  { name: "6号大棚", crop: "茄子", locked: false },
];

function loadFromStorage(): GreenhouseItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LIST;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LIST;
    // 修复约束: 保证 locked 的 1 号大棚存在且在首位
    const locked = parsed.find((g: GreenhouseItem) => g.name === LOCKED_NAME);
    const rest = parsed.filter((g: GreenhouseItem) => g.name !== LOCKED_NAME);
    const normalized: GreenhouseItem[] = [
      locked
        ? { ...locked, locked: true }
        : { name: LOCKED_NAME, crop: "番茄", locked: true },
      ...rest.map((g: GreenhouseItem) => ({ ...g, locked: false })),
    ];
    return normalized.slice(0, MAX_GREENHOUSES);
  } catch {
    return DEFAULT_LIST;
  }
}

function saveToStorage(list: GreenhouseItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

// 简易跨组件同步: storage 事件在其他 tab 改动时触发,
// 同 tab 内的多个 hook 实例通过自定义事件同步
const EVENT_NAME = "bearpi-agri:greenhouses-changed";

/**
 * 返回大棚列表与操作函数. 多处调用会共享 localStorage 状态,
 * 通过 storage 事件和自定义事件保持同步.
 */
export function useGreenhouses() {
  const [list, setList] = useState<GreenhouseItem[]>(loadFromStorage);

  // 监听其他组件/tab 的变化
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setList(loadFromStorage());
    };
    const onCustom = () => setList(loadFromStorage());
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom);
    };
  }, []);

  const commit = useCallback((next: GreenhouseItem[]) => {
    saveToStorage(next);
    setList(next);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }, []);

  const addGreenhouse = useCallback(
    (name: string, crop: string): { ok: boolean; error?: string } => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: "名称不能为空" };
      if (trimmed.length > 16) return { ok: false, error: "名称过长 (≤16 字)" };
      const current = loadFromStorage();
      if (current.length >= MAX_GREENHOUSES) {
        return { ok: false, error: `大棚数量已达上限 (${MAX_GREENHOUSES})` };
      }
      if (current.some((g) => g.name === trimmed)) {
        return { ok: false, error: "名称已存在" };
      }
      const next = [...current, { name: trimmed, crop, locked: false }];
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const removeGreenhouse = useCallback(
    (name: string): { ok: boolean; error?: string } => {
      const current = loadFromStorage();
      const target = current.find((g) => g.name === name);
      if (!target) return { ok: false, error: "未找到该大棚" };
      if (target.locked) return { ok: false, error: "该大棚绑定了真实硬件,不可删除" };
      commit(current.filter((g) => g.name !== name));
      return { ok: true };
    },
    [commit],
  );

  const updateCrop = useCallback(
    (name: string, crop: string): { ok: boolean; error?: string } => {
      const current = loadFromStorage();
      const idx = current.findIndex((g) => g.name === name);
      if (idx < 0) return { ok: false, error: "未找到该大棚" };
      const next = current.slice();
      next[idx] = { ...next[idx], crop };
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  return {
    list,
    addGreenhouse,
    removeGreenhouse,
    updateCrop,
    canAdd: list.length < MAX_GREENHOUSES,
  };
}
