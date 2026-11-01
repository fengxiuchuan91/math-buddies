// 家长设置，存在这台手机的 localStorage。

export interface Settings {
  /** 孩子的称呼，空着就不显示 */
  childName: string
  /** 今日练习题数 */
  dailySize: number
  /** 自由玩最多几分钟，0 表示不开放 */
  freeMinutes: number
  /** 暂停出新题 */
  pauseNew: boolean
  /** 首页“先录音”的提示已经关掉 */
  recordTipDismissed: boolean
  /** 首页“用自带浏览器打开”的提示已经关掉 */
  browserTipDismissed: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  childName: '',
  dailySize: 20,
  freeMinutes: 10,
  pauseNew: false,
  recordTipDismissed: false,
  browserTipDismissed: false,
}

const KEY = 'mb-settings'

/** 只收认识的键、类型对的值，其余用默认值 */
export function normalizeSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS }
  if (!raw || typeof raw !== 'object') return s
  const r = raw as Record<string, unknown>
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (typeof r[k] === typeof DEFAULT_SETTINGS[k]) (s as Record<string, unknown>)[k] = r[k]
  }
  s.childName = s.childName.slice(0, 12)
  s.dailySize = Math.min(40, Math.max(5, Math.round(s.dailySize)))
  s.freeMinutes = Math.min(30, Math.max(0, Math.round(s.freeMinutes)))
  return s
}

export function loadSettings(): Settings {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return { ...DEFAULT_SETTINGS } }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(normalizeSettings(s)))
}
