import { describe, expect, it } from 'vitest'
import { COMPANIONS, fact } from '../src/lib/facts'
import type { MbEvent } from '../src/lib/events'
import { replay } from '../src/lib/world'
import { buildDaily, buildFree, insertRetry, newAllowedToday, type Item } from '../src/lib/session'
import { seeded } from '../src/lib/rng'
import { D, answer, placement, session } from './helpers'

const companionOf = (it: Item) => fact(it.fact).companion
const adjacentSame = (items: Item[]) => items.filter((it, i) => i > 0 && companionOf(it) === companionOf(items[i - 1])).length

/** 恐龙 3~9 的事实分散在格子 1~3，到 D 全部到期 */
function richWorld() {
  const boxes: Record<string, number> = {}
  COMPANIONS.filter((c) => /^dino-[3-9]$/.test(c.id)).flatMap((c) => c.facts).forEach((id, i) => (boxes[id] = 1 + (i % 3)))
  return replay([placement(D - 20, boxes)])
}

describe('今日练习', () => {
  it('第一天：6 个新事实，恐龙岛和动物乐园轮着出，先教再问，隔几题再问一次', () => {
    const p = buildDaily(replay([]), { day: D, rng: seeded(1) })
    const news = p.items.filter((i) => i.role === 'new')
    expect(news.map((i) => i.fact)).toEqual(['1+1', 'see:3', '2-1', 'see:2', '2+0', 'see:4'])
    expect(news.every((i) => i.teach)).toBe(true)
    for (const [i, it] of p.items.entries()) {
      if (it.role !== 'new') continue
      const j = p.items.findIndex((x, k) => k > i && x.fact === it.fact && x.role === 'again')
      expect(j - i).toBeGreaterThanOrEqual(2)
    }
    expect(p.items).toHaveLength(12)
    expect(p.warmups).toHaveLength(8)
  })

  it('最近两次正确率不到八成，当天不出新事实', () => {
    const es: MbEvent[] = []
    for (const day of [D - 2, D - 1]) {
      es.push(...session(day, 'daily', true))
      for (let i = 0; i < 10; i++) es.push(answer(COMPANIONS[4].facts[i % 6], day, i < 5))
    }
    const w = replay(es)
    expect(newAllowedToday(w, D)).toBe(0)
    expect(buildDaily(w, { day: D, rng: seeded(2) }).items.some((i) => i.role === 'new')).toBe(false)
  })

  it('一天最多 6 个新事实，今天已经教过的算在里面', () => {
    const w = replay(['1+1', '2-1', 'see:3', 'see:2'].map((id) => answer(id, D, true)))
    expect(newAllowedToday(w, D)).toBe(2)
    expect(newAllowedToday(w, D, 6, true)).toBe(0)
  })

  it('到期的先排，过期最久的在前；题数不超过 20 加看图列式', () => {
    const w = richWorld()
    const p = buildDaily(w, { day: D, rng: seeded(3) })
    const scored = p.items.filter((i) => i.role !== 'picture' && i.role !== 'again')
    expect(scored.length).toBeLessThanOrEqual(20)
    const due = p.items.filter((i) => i.role === 'due').map((i) => w.facts.get(i.fact)!.due)
    expect(Math.min(...due)).toBe(D - 19)
    expect(p.items.filter((i) => i.role === 'picture').length).toBeLessThanOrEqual(2)
  })

  it('同一个小伙伴的题不挨着', () => {
    const w = richWorld()
    for (let seed = 1; seed <= 30; seed++) {
      expect(adjacentSame(buildDaily(w, { day: D, rng: seeded(seed) }).items)).toBe(0)
    }
  })

  it('有熟练线以后，热身只夹 2 道', () => {
    const w = replay([{ kind: 'baseline', id: 'b1', t: 0, digits: 1, ms: 1200 }])
    expect(buildDaily(w, { day: D, rng: seeded(4) }).warmups).toHaveLength(2)
  })
})

describe('自由玩与再问', () => {
  it('自由玩只出格子 3 以上的，不出新的', () => {
    const w = replay([placement(D, { '3+4': 3, '4+3': 4, '7-3': 1 })])
    const p = buildFree(w, seeded(5), 10)
    expect(p.items).toHaveLength(10)
    expect(new Set(p.items.map((i) => i.fact))).toEqual(new Set(['3+4', '4+3']))
    expect(p.items.every((i) => i.role === 'free' && !i.teach)).toBe(true)
    expect(buildFree(replay([]), seeded(5)).items).toHaveLength(0)
  })

  it('答错后隔 2~4 题再问', () => {
    const q: Item[] = Array.from({ length: 10 }, (_, i) => ({ fact: `${i}+0`, qtype: 'result', role: 'due', teach: false, scaffold: false }))
    for (let seed = 1; seed <= 20; seed++) {
      const out = insertRetry(q, 3, q[3], seeded(seed))
      const at = out.findIndex((x) => x.role === 'retry')
      expect(at - 3 - 1).toBeGreaterThanOrEqual(2)
      expect(at - 3 - 1).toBeLessThanOrEqual(4)
    }
  })
})
