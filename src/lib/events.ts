// 一切掌握情况都由事件重算，事件只追加。

export type Mode = 'daily' | 'free' | 'challenge' | 'placement'
export type QType =
  | 'result' | 'missing' | 'bond' | 'compare' | 'picture'
  | 'see' | 'ordNext' | 'ordPrev' | 'ordLine' | 'ordCompare'
  | 'teenMake' | 'teenSplit'

interface Base {
  id: string
  /** 毫秒时间戳 */
  t: number
}

export interface AnswerEvent extends Base {
  kind: 'answer'
  session: string
  fact: string
  qtype: QType
  mode: Mode
  correct: boolean
  ms: number
  expected: number | string
  given: number | string
  /** 点了喇叭重听。用时已从读完算起 */
  listened: boolean
  /** 本次练习里答错后的再问 */
  retry: boolean
}

export interface SessionStartEvent extends Base {
  kind: 'session_start'
  session: string
  mode: Mode
}

export interface SessionEndEvent extends Base {
  kind: 'session_end'
  session: string
  mode: Mode
  completed: boolean
}

/** 摸底结果：直接写入事实的格子 */
export interface PlacementEvent extends Base {
  kind: 'placement'
  boxes: Record<string, number>
}

/** 照着按数字的热身，用来定熟练线 */
export interface BaselineEvent extends Base {
  kind: 'baseline'
  digits: 1 | 2
  ms: number
}

export type MbEvent = AnswerEvent | SessionStartEvent | SessionEndEvent | PlacementEvent | BaselineEvent

/** 两台设备的事件合并：按编号去重，按（时间、编号）排序 */
export function mergeEvents(...lists: MbEvent[][]): MbEvent[] {
  const byId = new Map<string, MbEvent>()
  for (const list of lists) for (const e of list) if (!byId.has(e.id)) byId.set(e.id, e)
  return [...byId.values()].sort((x, y) => x.t - y.t || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

const DAY_MS = 86_400_000
const BEIJING_OFFSET_MS = 8 * 3_600_000

/** 北京时间的日历日序号。到期、一天一格都按它算 */
export function dayOf(t: number): number {
  return Math.floor((t + BEIJING_OFFSET_MS) / DAY_MS)
}

export function newId(): string {
  const c = globalThis.crypto
  // iOS 14 没有 randomUUID
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
