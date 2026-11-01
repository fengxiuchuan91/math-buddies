// 每个事实的格子与下次复习日。规则见 docs/design.md「记忆安排」。

import { dayOf, type AnswerEvent } from './events'

/** 格子 0~6 答对后隔几天再问 */
export const INTERVALS = [0, 1, 2, 4, 7, 14, 30] as const
export const MAX_BOX = INTERVALS.length - 1

export interface FactState {
  box: number
  /** 下次复习的日序号；没教过时无意义 */
  due: number
  introduced: boolean
  everCorrect: boolean
  /** 最近一次进格、减半的日子，一天各最多一次 */
  lastUp: number
  lastDown: number
  attempts: number
  wrong: number
  slow: number
  lastT: number
}

export function emptyState(): FactState {
  return { box: 0, due: 0, introduced: false, everCorrect: false, lastUp: -1, lastDown: -1, attempts: 0, wrong: 0, slow: 0, lastT: 0 }
}

export function applyAnswer(prev: FactState, e: AnswerEvent, fluent: boolean): FactState {
  const s = { ...prev }
  const day = dayOf(e.t)
  s.attempts++
  s.lastT = e.t
  if (!e.correct) s.wrong++
  else if (!fluent && e.qtype !== 'picture') s.slow++
  // 看图列式只记对错，不动格子：错可能出在读图
  if (e.qtype === 'picture') return s

  if (!s.introduced) {
    s.introduced = true
    s.due = day
  }

  if (e.correct) {
    s.everCorrect = true
    if (s.due > day) return s // 没到期：答对不进格
    if (s.lastUp === day) {
      // 今天已进过一格。至少排到明天，免得今天反复出
      s.due = day + Math.max(1, INTERVALS[s.box])
    } else if (s.box < 2 || fluent) {
      s.box = Math.min(MAX_BOX, s.box + 1)
      s.lastUp = day
      s.due = day + INTERVALS[s.box]
    } else {
      // 对但慢：留在原格，按原间隔再排
      s.due = day + INTERVALS[s.box]
    }
    return s
  }

  // 答错：一天只减半一次，免得一次练习里连错几次就清零
  if (s.lastDown !== day) {
    s.box = Math.floor(s.box / 2)
    s.lastDown = day
    s.due = day + INTERVALS[s.box]
  }
  return s
}

/** 摸底写入的格子。0 表示从头来，不动 */
export function applyPlacement(prev: FactState, box: number, t: number): FactState {
  if (box <= 0) return prev
  const day = dayOf(t)
  const b = Math.min(MAX_BOX, box)
  return { ...prev, box: b, introduced: true, everCorrect: true, due: day + INTERVALS[b], lastUp: day }
}
