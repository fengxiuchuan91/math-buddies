// 熟练线：他的按键用时 + 3 秒。一位数、两位数答案分开算。

import type { AnswerEvent, QType } from './events'

/** 计时有意义的题型。看图列式要先看图、选符号，用时不能和算式比 */
export const TIMED: ReadonlySet<QType> = new Set<QType>([
  'result', 'missing', 'bond', 'compare', 'see', 'ordNext', 'ordPrev', 'ordLine', 'ordCompare', 'teenMake', 'teenSplit',
])

export const EXTRA_MS = 3000
export const DEFAULT_BASELINE: Record<1 | 2, number> = { 1: 1500, 2: 2500 }
const WINDOW = 20

export interface Baseline {
  1: number[]
  2: number[]
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function thresholdMs(b: Baseline, digits: 1 | 2): number {
  const xs = b[digits].slice(-WINDOW)
  return (xs.length ? median(xs) : DEFAULT_BASELINE[digits]) + EXTRA_MS
}

export function digitsOf(expected: number | string): 1 | 2 {
  return String(expected).length >= 2 ? 2 : 1
}

export function isFluent(e: AnswerEvent, b: Baseline): boolean {
  return e.correct && TIMED.has(e.qtype) && e.ms <= thresholdMs(b, digitsOf(e.expected))
}
