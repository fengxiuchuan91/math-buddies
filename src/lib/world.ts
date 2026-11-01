// 从事件重算整座岛：每个事实的格子、小伙伴的成长阶段、星星、哪些世界开放。

import { COMPANIONS, FACTS, type Companion, type World } from './facts'
import { dayOf, type MbEvent, type Mode } from './events'
import { applyAnswer, applyPlacement, emptyState, type FactState } from './schedule'
import { isFluent, type Baseline } from './fluency'

export type Stage = 0 | 1 | 2 | 3
export const STAGE_NAMES = ['蛋', '小时候', '长大', '进化'] as const
const STAGE_RATIO = 0.8

export interface SessionSummary {
  id: string
  mode: Mode
  day: number
  completed: boolean
  firstTries: number
  firstCorrect: number
}

export interface WorldState {
  facts: Map<string, FactState>
  /** 成长阶段只升不降：取历史最高 */
  stages: Map<string, Stage>
  stars: number
  baseline: Baseline
  sessions: SessionSummary[]
  /** 日序号 → 当天第一次教的事实数 */
  newPerDay: Map<number, number>
  placed: boolean
}

export function stageOf(c: Companion, facts: Map<string, FactState>): Stage {
  const states = c.facts.map((id) => facts.get(id) ?? emptyState())
  if (!states.some((s) => s.everCorrect)) return 0
  const need = Math.ceil(c.facts.length * STAGE_RATIO)
  if (states.filter((s) => s.box >= 5).length >= need) return 3
  if (states.filter((s) => s.box >= 3).length >= need) return 2
  return 1
}

/** 一周从周一开始。日序号 0 是 1970-01-01，星期四 */
const weekOf = (day: number) => Math.floor((day + 3) / 7)

export function replay(events: MbEvent[]): WorldState {
  const facts = new Map<string, FactState>()
  const stages = new Map<string, Stage>()
  const baseline: Baseline = { 1: [], 2: [] }
  const sessions = new Map<string, SessionSummary>()
  const newPerDay = new Map<number, number>()
  const starDays = new Set<number>()
  const starWeeks = new Set<number>()
  let stars = 0
  let placed = false

  const bump = (companionId: string) => {
    const c = COMPANIONS.find((x) => x.id === companionId)!
    const s = stageOf(c, facts)
    if (s > (stages.get(c.id) ?? 0)) stages.set(c.id, s)
  }

  for (const e of events) {
    switch (e.kind) {
      case 'baseline':
        baseline[e.digits].push(e.ms)
        break
      case 'placement': {
        placed = true
        for (const [id, box] of Object.entries(e.boxes)) {
          if (!FACTS.has(id)) continue
          facts.set(id, applyPlacement(facts.get(id) ?? emptyState(), box, e.t))
        }
        for (const c of COMPANIONS) bump(c.id)
        break
      }
      case 'session_start':
        sessions.set(e.session, { id: e.session, mode: e.mode, day: dayOf(e.t), completed: false, firstTries: 0, firstCorrect: 0 })
        break
      case 'session_end': {
        const s = sessions.get(e.session)
        if (!s || !e.completed || s.completed) break
        s.completed = true
        const day = dayOf(e.t)
        if (e.mode === 'daily' && !starDays.has(day)) { starDays.add(day); stars += 10 }
        if (e.mode === 'challenge' && !starWeeks.has(weekOf(day))) { starWeeks.add(weekOf(day)); stars += 5 }
        break
      }
      case 'answer': {
        const f = FACTS.get(e.fact)
        // 摸底的作答只留作记录，格子由 placement 事件写入
        if (!f || e.mode === 'placement') break
        const prev = facts.get(e.fact) ?? emptyState()
        const next = applyAnswer(prev, e, isFluent(e, baseline))
        if (!prev.introduced && next.introduced) {
          const d = dayOf(e.t)
          newPerDay.set(d, (newPerDay.get(d) ?? 0) + 1)
        }
        facts.set(e.fact, next)
        const s = sessions.get(e.session)
        if (s && !e.retry) { s.firstTries++; if (e.correct) s.firstCorrect++ }
        bump(f.companion)
        break
      }
    }
  }
  return { facts, stages, stars, baseline, sessions: [...sessions.values()], newPerDay, placed }
}

export const stage = (w: WorldState, companionId: string): Stage => w.stages.get(companionId) ?? 0

/** 最近两次今日练习的首答正确率；不足两次时返回 null */
export function recentAccuracy(w: WorldState): number | null {
  const recent = w.sessions.filter((s) => s.mode === 'daily' && s.firstTries >= 5).slice(-2)
  if (recent.length < 2) return null
  const tries = recent.reduce((n, s) => n + s.firstTries, 0)
  return recent.reduce((n, s) => n + s.firstCorrect, 0) / tries
}

export function openWorlds(w: WorldState): World[] {
  const out: World[] = ['park', 'dino']
  if (stage(w, 'dino-10') >= 2 && stage(w, 'park-teen') >= 2) out.push('site')
  return out
}

export function dailyDone(w: WorldState, day: number): boolean {
  return w.sessions.some((s) => s.mode === 'daily' && s.completed && s.day === day)
}

/** 有事实到期、今天还没练过：小伙伴犯困 */
export function sleepy(w: WorldState, c: Companion, day: number): boolean {
  return c.facts.some((id) => {
    const s = w.facts.get(id)
    return !!s && s.introduced && s.due <= day && dayOf(s.lastT) !== day
  })
}

export const DECOR_EVERY = 100
export const DECOR_COUNT = 8
export const decorUnlocked = (w: WorldState) => Math.min(DECOR_COUNT, Math.floor(w.stars / DECOR_EVERY))
