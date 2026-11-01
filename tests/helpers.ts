import { fact } from '../src/lib/facts'
import type { AnswerEvent, MbEvent, Mode, PlacementEvent } from '../src/lib/events'

/** 测试用的固定日子：日序号 20000（北京时间 2024-10-04） */
export const D = 20000
const DAY = 86_400_000

/** 北京时间第 day 天的 hour 点 */
export const at = (day: number, hour = 10) => day * DAY - 8 * 3_600_000 + hour * 3_600_000

let seq = 0
const nextId = () => `e${String(++seq).padStart(6, '0')}`

export function answer(id: string, day: number, correct: boolean, o: Partial<AnswerEvent> = {}): AnswerEvent {
  const expected = fact(id).answer
  return {
    kind: 'answer', id: nextId(), t: at(day) + seq, session: `s${day}`, fact: id, qtype: 'result', mode: 'daily',
    correct, ms: 1000, expected, given: correct ? expected : expected + 5, listened: false, retry: false, ...o,
  }
}

export function placement(day: number, boxes: Record<string, number>): PlacementEvent {
  return { kind: 'placement', id: nextId(), t: at(day, 9) + seq, boxes }
}

export function session(day: number, mode: Mode, completed: boolean, id = `s${day}`): MbEvent[] {
  return [
    { kind: 'session_start', id: nextId(), t: at(day, 8) + seq, session: id, mode },
    { kind: 'session_end', id: nextId(), t: at(day, 20) + seq, session: id, mode, completed },
  ]
}

export const byTime = (es: MbEvent[]) => [...es].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1))
