import { describe, expect, it } from 'vitest'
import type { AnswerEvent, MbEvent, Mode } from '../src/lib/events'
import { fact } from '../src/lib/facts'
import { replay } from '../src/lib/world'
import { GRIDS, boxLevel, errorCounts, factText, topFacts, weekStats } from '../src/lib/report'
import { D, at, placement } from './helpers'

let n = 0
const start = (s: string, t: number, mode: Mode = 'daily'): MbEvent => ({ kind: 'session_start', id: `r${++n}`, t, session: s, mode })
const end = (s: string, t: number, completed = true, mode: Mode = 'daily'): MbEvent => ({ kind: 'session_end', id: `r${++n}`, t, session: s, mode, completed })
function ans(s: string, t: number, id: string, correct: boolean, o: Partial<AnswerEvent> = {}): AnswerEvent {
  const expected = fact(id).answer
  return {
    kind: 'answer', id: `r${++n}`, t, session: s, fact: id, qtype: 'result', mode: 'daily', correct, ms: 1500,
    expected, given: correct ? expected : expected + 7, listened: false, retry: false, ...o,
  }
}
const MIN = 60_000

describe('最近 7 天', () => {
  it('做完的天数、分钟、题数、首答正确率', () => {
    const t0 = at(D - 1)
    const t1 = at(D)
    const es: MbEvent[] = [
      // 昨天：10 分钟，4 题对 3 题，外加一道再问
      start('a', t0), ans('a', t0 + MIN, '3+4', true), ans('a', t0 + 2 * MIN, '4+3', true),
      ans('a', t0 + 3 * MIN, '7-3', false), ans('a', t0 + 4 * MIN, '7-3', true, { retry: true }),
      ans('a', t0 + 5 * MIN, '7-4', true), end('a', t0 + 10 * MIN),
      // 今天：开着页面走开了两个小时，只算 30 分钟；没做完
      start('b', t1), ans('b', t1 + MIN, '2+5', true), end('b', t1 + 120 * MIN, false),
      // 今天的摸底：算时长，但题不算
      start('p', t1, 'placement'), ans('p', t1 + MIN, '8+5', false, { mode: 'placement' }), end('p', t1 + 3 * MIN, true, 'placement'),
      // 8 天前：不在最近 7 天里
      start('old', at(D - 7)), ans('old', at(D - 7) + MIN, '1+1', true), end('old', at(D - 7) + 5 * MIN),
    ]
    const s = weekStats(es, replay(es), D)
    expect(s.daysDone).toBe(1)
    expect(s.minutes).toBe(10 + 30 + 3)
    expect(s.questions).toBe(5)
    expect(s.accuracy).toBeCloseTo(4 / 5)
  })

  it('没练过时正确率为 null', () => {
    expect(weekStats([], replay([]), D)).toEqual({ daysDone: 0, minutes: 0, questions: 0, accuracy: null })
  })
})

describe('慢题、错题、错法', () => {
  const t = at(D)
  const es: MbEvent[] = [
    start('s', t),
    ...[1, 2, 3].map((i) => ans('s', t + i * MIN, '8+5', false, { given: 3 })),
    ans('s', t + 5 * MIN, '13-5', false, { given: 12 }),
    ans('s', t + 6 * MIN, '3+4', true, { ms: 9000 }),
    ans('s', t + 7 * MIN, '3+4', true, { ms: 9000 }),
    ans('s', t + 8 * MIN, '4+3', true, { ms: 9000 }),
    ans('s', t + 9 * MIN, '6+2', false, { qtype: 'missing', given: 1 }),
    ans('s', t + 10 * MIN, '9+9', false, { mode: 'placement' }),
  ]
  const w = replay(es)

  it('错得最多的排在前面', () => {
    const top = topFacts(w, 'wrong')
    expect(top[0]).toEqual({ fact: '8+5', text: '8 + 5', count: 3 })
    expect(top.map((x) => x.fact)).toContain('13-5')
  })

  it('对但慢最多的排在前面，最多取 n 个', () => {
    const top = topFacts(w, 'slow', 1)
    expect(top).toEqual([{ fact: '3+4', text: '3 + 4', count: 2 }])
  })

  it('错法只看求得数的题，摸底不算', () => {
    const c = errorCounts(es)
    expect(c.forgotCarry).toBe(3)
    expect(c.borrowReverse).toBe(1)
    expect(c.off1 + c.wrongOp + c.other).toBe(0)
  })

  it('算式写法', () => {
    expect(factText('13-5')).toBe('13 − 5')
    expect(factText('teen:14')).toBe('14 的组成')
  })
})

describe('加减法表', () => {
  it('加法 9×9 全是存在的事实', () => {
    const g = GRIDS.find((x) => x.key === 'add')!
    expect(g.cells.flat()).toHaveLength(81)
    expect(g.cells.flat().every((id) => id !== null)).toBe(true)
    expect(g.cells[7][4]).toBe('8+5')
  })

  it('退位减表：只有个位不够减的格子有题，36 道', () => {
    const g = GRIDS.find((x) => x.key === 'borrow')!
    const ids = g.cells.flat().filter(Boolean)
    expect(ids).toHaveLength(36)
    expect(g.cells[2][3]).toBe('13-5')
    expect(g.cells[1][0]).toBeNull() // 12−2 不退位
  })

  it('10 以内减表：减数不大于被减数', () => {
    const g = GRIDS.find((x) => x.key === 'sub10')!
    expect(g.cells[6][3]).toBe('7-3')
    expect(g.cells[2][5]).toBeNull()
    expect(g.cells.flat().filter(Boolean).every((id) => fact(id!).a <= 10)).toBe(true)
  })

  it('按格子分颜色档', () => {
    const w = replay([placement(D, { '1+1': 1, '1+2': 2, '1+3': 3, '1+4': 6 })])
    expect(['2+2', '1+1', '1+2', '1+3', '1+4'].map((id) => boxLevel(w, id))).toEqual(['none', 'new', 'learning', 'ok', 'solid'])
  })
})
