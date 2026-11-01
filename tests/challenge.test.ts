import { describe, expect, it } from 'vitest'
import { COMPANIONS, fact } from '../src/lib/facts'
import type { AnswerEvent, MbEvent } from '../src/lib/events'
import { replay, weekOf } from '../src/lib/world'
import { buildChallenge, challengeFacts, challengeHistory, challengeReady, CHALLENGE_SIZE } from '../src/lib/challenge'
import { seeded } from '../src/lib/rng'
import { D, answer, at, placement } from './helpers'

/** 恐龙 3~7 的加减法：60 个事实 */
const pool = COMPANIONS.filter((c) => /^dino-[3-7]$/.test(c.id)).flatMap((c) => c.facts)
const boxes = (ids: string[], box: number) => Object.fromEntries(ids.map((id) => [id, box]))

let n = 0
/** 一次口算挑战：开始、作答、结束，时间严格递增 */
function challenge(day: number, answers: [string, boolean][], completed = true, seconds = 90): MbEvent[] {
  const session = `c${++n}`
  const t0 = at(day, 15)
  const es: MbEvent[] = [{ kind: 'session_start', id: `${session}-s`, t: t0, session, mode: 'challenge' }]
  answers.forEach(([id, ok], i) => {
    es.push(answer(id, day, ok, { session, mode: 'challenge', t: t0 + 1000 * (i + 1) } as Partial<AnswerEvent>))
  })
  es.push({ kind: 'session_end', id: `${session}-e`, t: t0 + seconds * 1000, session, mode: 'challenge', completed })
  return es
}

describe('口算挑战出现的条件', () => {
  it('熟题（格子 3 以上的加减法）够 20 道才出现', () => {
    expect(challengeReady(replay([placement(D, boxes(pool.slice(0, 19), 3))]), [], D)).toBe(false)
    expect(challengeReady(replay([placement(D, boxes(pool.slice(0, 20), 3))]), [], D)).toBe(true)
    // 格子 2 不算熟题
    expect(challengeReady(replay([placement(D, boxes(pool.slice(0, 30), 2))]), [], D)).toBe(false)
  })

  it('点子卡、数的顺序、十几的组成不算', () => {
    const others = COMPANIONS.filter((c) => c.world === 'park').flatMap((c) => c.facts)
    expect(others.length).toBeGreaterThan(20)
    const w = replay([placement(D, boxes(others, 4))])
    expect(challengeFacts(w)).toHaveLength(0)
    expect(challengeReady(w, [], D)).toBe(false)
  })

  it('本周做完一次就不再出现，下周一又出现；没做完的不算', () => {
    const base: MbEvent[] = [placement(D - 10, boxes(pool, 4))]
    const done = challenge(D, pool.slice(0, 20).map((id) => [id, true]))
    const all = [...base, ...done]
    const w = replay(all)
    // D 是星期五；D+3 是下周一
    expect(weekOf(D + 2)).toBe(weekOf(D))
    expect(weekOf(D + 3)).toBe(weekOf(D) + 1)
    expect(challengeReady(w, all, D)).toBe(false)
    expect(challengeReady(w, all, D + 2)).toBe(false)
    expect(challengeReady(w, all, D + 3)).toBe(true)

    const quit = [...base, ...challenge(D, [[pool[0], true]], false)]
    expect(challengeReady(replay(quit), quit, D)).toBe(true)
  })

  it('做完得 5 颗星，一周只算一次', () => {
    const all = [...challenge(D, [[pool[0], true]]), ...challenge(D + 1, [[pool[1], true]])]
    expect(replay(all).stars).toBe(5)
  })
})

describe('出题', () => {
  const w = replay([placement(D, { ...boxes(pool, 4), ...boxes(pool.slice(0, 5), 2) })])

  it('20 道不重复的熟题，约 4 道求加数或减数', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const qs = buildChallenge(w, seeded(seed))
      expect(qs).toHaveLength(CHALLENGE_SIZE)
      expect(new Set(qs.map((q) => q.fact)).size).toBe(CHALLENGE_SIZE)
      for (const q of qs) {
        expect(w.facts.get(q.fact)!.box).toBeGreaterThanOrEqual(3)
        expect(['add', 'sub']).toContain(fact(q.fact).kind)
        expect((q.text.match(/□/g) ?? []).length).toBe(1)
      }
      expect(qs.filter((q) => q.qtype === 'missing')).toHaveLength(4)
      expect(qs.filter((q) => q.qtype === 'result')).toHaveLength(16)
    }
  })

  it('同一个小伙伴的题不挨着', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const qs = buildChallenge(w, seeded(seed))
      const same = qs.filter((q, i) => i > 0 && fact(q.fact).companion === fact(qs[i - 1].fact).companion)
      expect(same).toHaveLength(0)
    }
  })

  it('答案和题面对得上', () => {
    for (const q of buildChallenge(w, seeded(7))) {
      const [x, op, y, , z] = q.text.replace('□', String(q.answer)).replace('−', '-').split(' ')
      expect(op === '+' ? +x + +y : +x - +y).toBe(+z)
    }
  })
})

describe('历史成绩', () => {
  it('记下用时、对了几道、一共几道；没做完的不算', () => {
    const es = [
      ...challenge(D, [[pool[0], true], [pool[1], false], [pool[2], true]], true, 95),
      ...challenge(D + 1, [[pool[3], true]], false),
      ...challenge(D + 7, [[pool[4], true], [pool[5], true]], true, 80),
    ]
    const h = challengeHistory(es)
    expect(h).toHaveLength(2)
    expect(h[0]).toMatchObject({ day: D, ms: 95_000, correct: 2, total: 3 })
    expect(h[1]).toMatchObject({ day: D + 7, ms: 80_000, correct: 2, total: 2 })
  })

  it('今日练习的作答不算进口算挑战', () => {
    const es = [...challenge(D, [[pool[0], true]]), answer(pool[1], D, true)]
    expect(challengeHistory(es)[0].total).toBe(1)
  })
})
