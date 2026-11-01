import { describe, expect, it } from 'vitest'
import { FACTS, fact } from '../src/lib/facts'
import type { QType } from '../src/lib/events'
import { makeQuestion, type Question } from '../src/lib/questions'
import { explain } from '../src/lib/explain'
import { classify } from '../src/lib/errors'
import { isFluent, thresholdMs, digitsOf } from '../src/lib/fluency'
import { placementBoxes, placementItems, shouldSkip } from '../src/lib/placement'
import { COMPANIONS } from '../src/lib/facts'
import { seeded } from '../src/lib/rng'
import { D, answer } from './helpers'

function qtypesFor(id: string): QType[] {
  const f = fact(id)
  switch (f.kind) {
    case 'see': return ['see']
    case 'ord': return ['ordNext', 'ordPrev', 'ordLine', 'ordCompare']
    case 'teen': return ['teenMake', 'teenSplit']
    default: {
      const t: QType[] = ['result', 'missing', 'compare']
      if (f.a > 0 && f.b > 0 && f.a <= 10 && f.b <= 10) t.push('picture')
      if ((f.kind === 'add' && f.answer <= 10) || (f.kind === 'sub' && f.a <= 10)) t.push('bond')
      return t
    }
  }
}

/** 把答案填回题面，按算式求值，检查题和答案对得上 */
function check(q: Question) {
  const f = fact(q.fact)
  const ans = String(q.answer)
  const filled = q.text.replace('□', ans).replace(/−/g, '-')
  const eq = filled.match(/^(\d+) ([+-]) (\d+) = (\d+)$/)
  if (eq) {
    const [, x, op, y, z] = eq
    expect(op === '+' ? +x + +y : +x - +y).toBe(+z)
    return
  }
  switch (q.qtype) {
    case 'bond': {
      const v = q.visual as { whole: number | null; left: number | null; right: number | null }
      const whole = v.whole ?? +ans, left = v.left ?? +ans, right = v.right ?? +ans
      expect(left + right).toBe(whole)
      return
    }
    case 'compare': {
      const k = +q.text.split('○ ')[1]
      expect(ans).toBe(f.answer > k ? '>' : f.answer < k ? '<' : '=')
      return
    }
    case 'ordCompare': {
      const [x, y] = q.text.split(' ○ ').map(Number)
      expect(ans).toBe(x > y ? '>' : x < y ? '<' : '=')
      return
    }
    case 'picture':
      expect(ans).toBe(`${f.kind === 'sub' ? '-' : '+'}${f.answer}`)
      return
    case 'teenSplit':
      expect(+ans).toBe(f.a === 20 ? 2 : f.a - 10)
      return
    case 'ordLine': {
      const v = q.visual as { nums: (number | null)[] }
      expect(v.nums.filter((x) => x === null)).toHaveLength(1)
      expect(+ans).toBe(f.answer)
      return
    }
    default:
      expect(+ans).toBe(f.answer)
  }
}

describe('出题', () => {
  it('每个事实的每种题型，填回答案都成立', () => {
    for (const id of FACTS.keys()) for (const t of qtypesFor(id)) for (let s = 1; s <= 4; s++) check(makeQuestion(id, t, seeded(s)))
  })

  it('题面只有一个空', () => {
    for (const id of FACTS.keys()) for (const t of qtypesFor(id)) {
      const q = makeQuestion(id, t, seeded(9))
      expect((q.text.match(/□/g) ?? []).length).toBeLessThanOrEqual(1)
    }
  })
})

describe('讲解', () => {
  it('每个事实都有讲解，十格图不超过两格', () => {
    for (const id of FACTS.keys()) {
      const steps = explain(id)
      expect(steps.length).toBeGreaterThan(0)
      for (const s of steps) if (s.visual.kind === 'frames') expect([10, 20]).toContain(s.visual.cells.length)
    }
  })

  it('8+5 用凑十：8 和 2 凑成 10，再加 3', () => {
    const s = explain('8+5')
    expect(s).toHaveLength(3)
    expect(s[1].text).toContain('分成 2 和 3')
    expect(s[2].text).toContain('10 + 3 = 13')
  })

  it('13−5 用破十：10 − 5 = 5，5 + 3 = 8，也可以想加算减', () => {
    const s = explain('13-5')
    expect(s[1].text).toContain('10 − 5 = 5')
    expect(s[2].text).toContain('5 + 3 = 8')
    expect(s[2].text).toContain('5 + 8 = 13')
  })
})

describe('错法归类', () => {
  it.each([
    ['13-5', 12, 'borrowReverse'],
    ['11-9', 18, 'borrowReverse'],
    ['8+5', 3, 'forgotCarry'],
    ['8+5', 12, 'off1'],
    ['8+5', 14, 'off1'],
    ['7-3', 10, 'wrongOp'],
    ['3+4', 1, 'wrongOp'],
    ['3+4', 9, 'other'],
  ] as const)('%s 答 %s 是 %s', (id, given, kind) => {
    expect(classify(fact(id), 'result', fact(id).answer, given)).toBe(kind)
  })
})

describe('熟练线', () => {
  it('取热身中位数加 3 秒，一位数和两位数分开', () => {
    const b = { 1: [1000, 1400, 1200], 2: [] as number[] }
    expect(thresholdMs(b, 1)).toBe(4200)
    expect(thresholdMs(b, 2)).toBe(5500)
    expect(digitsOf(13)).toBe(2)
    expect(digitsOf('>')).toBe(1)
  })

  it('答对且不超过熟练线才算熟练；看图列式不算', () => {
    const b = { 1: [1000], 2: [2000] }
    expect(isFluent(answer('3+4', D, true, { ms: 3900 }), b)).toBe(true)
    expect(isFluent(answer('3+4', D, true, { ms: 4100 }), b)).toBe(false)
    expect(isFluent(answer('8+5', D, true, { ms: 4900 }), b)).toBe(true)
    expect(isFluent(answer('3+4', D, true, { ms: 500, qtype: 'picture' }), b)).toBe(false)
  })
})

describe('摸底', () => {
  it('约 30 题，事实都存在', () => {
    const items = placementItems(seeded(1))
    expect(items.length).toBeGreaterThanOrEqual(25)
    expect(items.length).toBeLessThanOrEqual(35)
    for (const it of items) expect(FACTS.has(it.fact)).toBe(true)
  })

  it('熟练 4、慢 1、错 0；一只小伙伴抽到的都熟练，没考到的放格子 3', () => {
    const d5 = COMPANIONS.find((c) => c.id === 'dino-5')!
    const boxes = placementBoxes([
      { fact: '2+3', correct: true, fluent: true },
      { fact: '5-1', correct: true, fluent: true },
      { fact: '4+4', correct: true, fluent: false },
      { fact: '6-2', correct: false, fluent: false },
    ])
    expect(boxes['2+3']).toBe(4)
    expect(boxes['4+4']).toBe(1)
    expect(boxes['6-2']).toBe(0)
    for (const id of d5.facts) if (id !== '2+3' && id !== '5-1') expect(boxes[id]).toBe(3)
    expect(boxes['1+7']).toBeUndefined()
  })

  it('一类题错到 3 道就停', () => {
    const item = { fact: '8+5', qtype: 'result' as const, group: 'site' as const }
    expect(shouldSkip(item, { site: 2 })).toBe(false)
    expect(shouldSkip(item, { site: 3 })).toBe(true)
  })
})
