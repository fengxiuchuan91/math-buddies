import { describe, expect, it } from 'vitest'
import { applyAnswer, applyPlacement, emptyState, type FactState } from '../src/lib/schedule'
import { D, answer, at } from './helpers'

const run = (s: FactState, ...steps: [number, boolean, boolean?][]) =>
  steps.reduce((acc, [day, correct, fluent = true]) => applyAnswer(acc, answer('3+4', day, correct), fluent), s)

const atBox = (box: number, due = D): FactState => ({ ...emptyState(), introduced: true, everCorrect: true, box, due })

describe('格子与排期', () => {
  it('新事实教完答对，进格子 1，明天再问', () => {
    const s = run(emptyState(), [D, true])
    expect(s).toMatchObject({ introduced: true, box: 1, due: D + 1 })
  })

  it('一路答对：间隔 1、2、4、7、14、30 天', () => {
    let s = run(emptyState(), [D, true])
    const days = [s.due]
    while (s.box < 6) {
      s = run(s, [s.due, true])
      days.push(s.due)
    }
    expect(days.map((d, i) => d - (i ? days[i - 1] : D))).toEqual([1, 2, 4, 7, 14, 30])
  })

  it('格子 0、1 只要答对；格子 2 以上答对但不熟练，不进格，按原间隔再排', () => {
    expect(run(atBox(1), [D, true, false]).box).toBe(2)
    const s = run(atBox(2), [D, true, false])
    expect(s).toMatchObject({ box: 2, due: D + 2, slow: 1 })
  })

  it('同一天答对两次，只进一格', () => {
    // 教新：错一次、对一次、再对一次
    const s = run(emptyState(), [D, false], [D, true], [D, true])
    expect(s.box).toBe(1)
    expect(s.due).toBe(D + 1)
  })

  it('答错减半取整，当天就要再练', () => {
    expect(run(atBox(6), [D, false]).box).toBe(3)
    expect(run(atBox(3), [D, false]).box).toBe(1)
    expect(run(atBox(1), [D, false])).toMatchObject({ box: 0, due: D })
  })

  it('一天里连错几次，只减半一次', () => {
    expect(run(atBox(6), [D, false], [D, false], [D, false]).box).toBe(3)
  })

  it('答错后再答对：格子 0 进到 1，其余留在减半后的格子', () => {
    expect(run(atBox(1), [D, false], [D, true]).box).toBe(1)
    expect(run(atBox(4), [D, false], [D, true]).box).toBe(2)
  })

  it('没到期答对不进格；答错照样减半', () => {
    expect(run(atBox(4, D + 3), [D, true]).box).toBe(4)
    expect(run(atBox(4, D + 3), [D, false]).box).toBe(2)
  })

  it('过期很久再答对，从答对那天起排', () => {
    const s = run(atBox(3, D - 10), [D, true])
    expect(s).toMatchObject({ box: 4, due: D + 7 })
  })

  it('看图列式只记对错，不动格子', () => {
    const s = applyAnswer(atBox(3), answer('3+4', D, false, { qtype: 'picture' }), false)
    expect(s).toMatchObject({ box: 3, wrong: 1, due: D })
  })

  it('摸底写入格子；0 不动', () => {
    expect(applyPlacement(emptyState(), 4, at(D))).toMatchObject({ box: 4, introduced: true, due: D + 7 })
    expect(applyPlacement(emptyState(), 0, at(D)).introduced).toBe(false)
  })
})
