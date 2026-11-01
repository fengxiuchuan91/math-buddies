import { describe, expect, it } from 'vitest'
import { COMPANIONS, FACTS, crossesTen, fact } from '../src/lib/facts'

describe('事实表', () => {
  it('22 个小伙伴，约 270 个事实，每个事实只属于一个小伙伴', () => {
    expect(COMPANIONS).toHaveLength(22)
    const all = COMPANIONS.flatMap((c) => c.facts)
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(FACTS.size)
    expect(FACTS.size).toBeGreaterThan(250)
    expect(FACTS.size).toBeLessThan(300)
    for (const c of COMPANIONS) for (const id of c.facts) expect(fact(id).companion).toBe(c.id)
  })

  it('三个世界：动物乐园 3、恐龙岛 9、工地 10', () => {
    const n = (w: string) => COMPANIONS.filter((c) => c.world === w).length
    expect([n('park'), n('dino'), n('site')]).toEqual([3, 9, 10])
  })

  it('答案都在 0~20', () => {
    for (const f of FACTS.values()) {
      expect(f.answer).toBeGreaterThanOrEqual(0)
      expect(f.answer).toBeLessThanOrEqual(20)
    }
  })

  it('进位加 36 个、退位减 36 个，全在工地', () => {
    const crossing = [...FACTS.values()].filter(crossesTen)
    expect(crossing.filter((f) => f.kind === 'add')).toHaveLength(36)
    expect(crossing.filter((f) => f.kind === 'sub')).toHaveLength(36)
    for (const f of crossing) expect(f.companion.startsWith('site-')).toBe(true)
  })

  it('进位加按第一个加数分组，退位减按减数分组', () => {
    expect(fact('9+2').companion).toBe('site-add9')
    expect(fact('2+9').companion).toBe('site-add5432')
    expect(fact('13-5').companion).toBe('site-sub5432')
    expect(fact('15-9').companion).toBe('site-sub9')
  })

  it('n 号恐龙管和是 n 的加法、从 n 减的减法', () => {
    const d7 = COMPANIONS.find((c) => c.id === 'dino-7')!
    expect(d7.facts).toContain('3+4')
    expect(d7.facts).toContain('7-3')
    expect(d7.facts).toContain('0+7')
    expect(d7.facts).toHaveLength(16)
    expect(COMPANIONS.find((c) => c.id === 'dino-10')!.facts).toContain('10-4')
  })
})
