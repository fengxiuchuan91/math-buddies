// 家长区的报表：全部从事件和重算后的 WorldState 得出，不另存。

import { fact, FACTS } from './facts'
import type { AnswerEvent, MbEvent } from './events'
import { dayOf } from './events'
import { classify, type ErrorKind } from './errors'
import type { WorldState } from './world'

export const WEEK_DAYS = 7
/** 单次练习最多算 30 分钟：孩子中途走开、页面没关，不该把时长拉得很长 */
export const SESSION_CAP_MS = 30 * 60_000

export interface WeekStats {
  daysDone: number
  minutes: number
  questions: number
  /** 首答正确率；没有题时为 null */
  accuracy: number | null
}

const inWeek = (d: number, today: number) => d <= today && d > today - WEEK_DAYS

/** 只看真正的练习题：摸底的作答不算（热身是 baseline 事件，本来就不在 answer 里） */
const practiceAnswer = (e: MbEvent): e is AnswerEvent => e.kind === 'answer' && e.mode !== 'placement'

export function weekStats(events: MbEvent[], w: WorldState, today: number): WeekStats {
  const daysDone = new Set(
    w.sessions.filter((s) => s.mode === 'daily' && s.completed && inWeek(s.day, today)).map((s) => s.day),
  ).size

  // 每次练习：从 session_start 算到这次练习的最后一条事件
  const start = new Map<string, number>()
  const last = new Map<string, number>()
  for (const e of events) {
    if (e.kind === 'session_start') start.set(e.session, e.t)
    if (e.kind === 'session_start' || e.kind === 'session_end' || e.kind === 'answer') {
      last.set(e.session, Math.max(last.get(e.session) ?? 0, e.t))
    }
  }
  let ms = 0
  for (const [id, t0] of start) {
    if (!inWeek(dayOf(t0), today)) continue
    ms += Math.min(SESSION_CAP_MS, Math.max(0, (last.get(id) ?? t0) - t0))
  }

  const firsts = events.filter((e): e is AnswerEvent => practiceAnswer(e) && !e.retry && inWeek(dayOf(e.t), today))
  const right = firsts.filter((e) => e.correct).length
  return {
    daysDone,
    minutes: Math.round(ms / 60_000),
    questions: firsts.length,
    accuracy: firsts.length ? right / firsts.length : null,
  }
}

/** 给家长看的算式写法 */
export function factText(id: string): string {
  const f = fact(id)
  switch (f.kind) {
    case 'add': return `${f.a} + ${f.b}`
    case 'sub': return `${f.a} − ${f.b}`
    case 'see': return `一眼看出 ${f.a}`
    case 'ord': return `数的顺序 ${f.a}`
    case 'teen': return `${f.a} 的组成`
  }
}

export interface RankEntry {
  fact: string
  text: string
  count: number
}

/** 对但慢最多、错得最多的事实，各取前 n 个 */
export function topFacts(w: WorldState, by: 'slow' | 'wrong', n = 10): RankEntry[] {
  return [...w.facts.entries()]
    .filter(([id, s]) => FACTS.has(id) && s[by] > 0)
    .sort(([ia, a], [ib, b]) => b[by] - a[by] || (ia < ib ? -1 : 1))
    .slice(0, n)
    .map(([id, s]) => ({ fact: id, text: factText(id), count: s[by] }))
}

/** 错法分布：只看求得数的题，别的题型看不出错在哪一步 */
export function errorCounts(events: MbEvent[]): Record<ErrorKind, number> {
  const out: Record<ErrorKind, number> = { off1: 0, wrongOp: 0, forgotCarry: 0, borrowReverse: 0, other: 0 }
  for (const e of events) {
    if (!practiceAnswer(e) || e.correct || e.qtype !== 'result' || !FACTS.has(e.fact)) continue
    out[classify(fact(e.fact), e.qtype, e.expected, e.given)]++
  }
  return out
}

// —— 加减法表 ——

export type BoxLevel = 'none' | 'new' | 'learning' | 'ok' | 'solid'

export const LEVELS: { level: BoxLevel; name: string; color: string }[] = [
  { level: 'none', name: '没教过', color: '#e3e8ee' },
  { level: 'new', name: '格子 0~1', color: '#ff8a80' },
  { level: 'learning', name: '格子 2', color: '#ffb74d' },
  { level: 'ok', name: '格子 3~4', color: '#aed581' },
  { level: 'solid', name: '格子 5~6', color: '#43a047' },
]

export function boxLevel(w: WorldState, id: string): BoxLevel {
  const s = w.facts.get(id)
  if (!s || !s.introduced) return 'none'
  if (s.box <= 1) return 'new'
  if (s.box === 2) return 'learning'
  if (s.box <= 4) return 'ok'
  return 'solid'
}

export interface Grid {
  key: string
  title: string
  rows: number[]
  cols: number[]
  /** cells[行][列]：事实编号；不是这张表的题时为 null */
  cells: (string | null)[][]
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const has = (id: string) => (FACTS.has(id) ? id : null)

export const GRIDS: Grid[] = [
  {
    key: 'add', title: '加法 1~9', rows: range(1, 9), cols: range(1, 9),
    cells: range(1, 9).map((a) => range(1, 9).map((b) => has(`${a}+${b}`))),
  },
  {
    key: 'borrow', title: '退位减', rows: range(11, 18), cols: range(2, 9),
    cells: range(11, 18).map((a) => range(2, 9).map((b) => (b > a % 10 && a - b < 10 ? has(`${a}-${b}`) : null))),
  },
  {
    key: 'sub10', title: '10 以内减', rows: range(1, 10), cols: range(0, 10),
    cells: range(1, 10).map((a) => range(0, 10).map((b) => (b <= a ? has(`${a}-${b}`) : null))),
  },
]
