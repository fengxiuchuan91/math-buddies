// 每周口算挑战：一页 20 道熟题，像学校口算纸。只和自己上次比用时，不排名。

import { fact as factOf } from './facts'
import { dayOf, type MbEvent, type QType } from './events'
import { weekOf, type WorldState } from './world'
import { interleave, type Item } from './session'
import { makeQuestion } from './questions'
import { shuffle, type Rng } from './rng'

export const CHALLENGE_SIZE = 20
/** 约 4 道求加数、减数，和学校口算纸一样不全是求得数 */
export const CHALLENGE_MISSING = 4
/** 格子 3 以上才算熟题 */
export const CHALLENGE_MIN_BOX = 3

export interface ChallengeQ {
  fact: string
  qtype: QType
  /** 题面，□ 是要填的空 */
  text: string
  answer: number
}

export interface ChallengeRecord {
  session: string
  day: number
  /** 从开始到交卷 */
  ms: number
  correct: number
  total: number
}

/** 熟题：格子 3 以上的加减法。按编号排序，结果可复现 */
export function challengeFacts(w: WorldState): string[] {
  return [...w.facts.entries()]
    .filter(([id, s]) => s.box >= CHALLENGE_MIN_BOX && ['add', 'sub'].includes(factOf(id).kind))
    .map(([id]) => id)
    .sort()
}

/** 做完了的口算挑战，按时间先后 */
export function challengeHistory(events: MbEvent[]): ChallengeRecord[] {
  const open = new Map<string, { t: number; correct: number; total: number }>()
  const out: ChallengeRecord[] = []
  for (const e of events) {
    if (e.kind === 'session_start' && e.mode === 'challenge') {
      open.set(e.session, { t: e.t, correct: 0, total: 0 })
    } else if (e.kind === 'answer' && e.mode === 'challenge') {
      const s = open.get(e.session)
      if (s) { s.total++; if (e.correct) s.correct++ }
    } else if (e.kind === 'session_end' && e.mode === 'challenge') {
      const s = open.get(e.session)
      open.delete(e.session)
      if (s && e.completed) out.push({ session: e.session, day: dayOf(s.t), ms: e.t - s.t, correct: s.correct, total: s.total })
    }
  }
  return out
}

/** 熟题够 20 道，并且本周还没做完过 */
export function challengeReady(w: WorldState, events: MbEvent[], day: number): boolean {
  if (challengeFacts(w).length < CHALLENGE_SIZE) return false
  const week = weekOf(day)
  return !challengeHistory(events).some((r) => weekOf(r.day) === week)
}

export function buildChallenge(w: WorldState, rng: Rng): ChallengeQ[] {
  const picked = shuffle(rng, challengeFacts(w)).slice(0, CHALLENGE_SIZE)
  const missing = new Set(shuffle(rng, picked).slice(0, CHALLENGE_MISSING))
  const items: Item[] = picked.map((id) => ({
    fact: id, qtype: missing.has(id) ? 'missing' : 'result', role: 'free', teach: false, scaffold: false,
  }))
  // 借用今日练习的排法：同一个小伙伴的题尽量不挨着
  return interleave(items, [], rng).map((it) => {
    const q = makeQuestion(it.fact, it.qtype, rng)
    return { fact: it.fact, qtype: it.qtype, text: q.text, answer: Number(q.answer) }
  })
}
