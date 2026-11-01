// 组卷：今日练习、自由玩。规则见 docs/design.md「今日练习」。

import { COMPANIONS, fact as factOf, type World } from './facts'
import type { QType } from './events'
import { canPicture, chooseQType } from './questions'
import { emptyState } from './schedule'
import { openWorlds, recentAccuracy, type WorldState } from './world'
import { shuffle, type Rng } from './rng'

export type Role = 'due' | 'new' | 'again' | 'retry' | 'filler' | 'picture' | 'free'

export interface Item {
  fact: string
  qtype: QType
  role: Role
  /** 先演示再问 */
  teach: boolean
  /** 今天错过两次：带着十格图出 */
  scaffold: boolean
}

export interface Plan {
  items: Item[]
  /** 照着按的数字，用来更新熟练线 */
  warmups: number[]
}

export interface DailyOpts {
  day: number
  rng: Rng
  size?: number
  newCap?: number
  pauseNew?: boolean
}

export const DAILY_SIZE = 20
export const NEW_CAP = 6
export const MIN_ACCURACY = 0.8
const WORLD_ORDER: World[] = ['dino', 'park', 'site']

/** 按世界轮流取下一批要教的事实。每个世界里小伙伴按顺序孵 */
export function nextNewFacts(w: WorldState, limit: number): string[] {
  const open = WORLD_ORDER.filter((x) => openWorlds(w).includes(x))
  const queues = open.map((world) =>
    COMPANIONS.filter((c) => c.world === world)
      .flatMap((c) => c.facts)
      .filter((id) => !(w.facts.get(id)?.introduced)),
  )
  const out: string[] = []
  for (let i = 0; out.length < limit && queues.some((q) => q.length); i++) {
    const q = queues[i % queues.length]
    if (q.length) out.push(q.shift()!)
  }
  return out
}

export function newAllowedToday(w: WorldState, day: number, cap = NEW_CAP, pause = false): number {
  if (pause) return 0
  const acc = recentAccuracy(w)
  if (acc !== null && acc < MIN_ACCURACY) return 0
  return Math.max(0, cap - (w.newPerDay.get(day) ?? 0))
}

const companionOf = (id: string) => factOf(id).companion

export function buildDaily(w: WorldState, o: DailyOpts): Plan {
  const size = o.size ?? DAILY_SIZE
  const { day, rng } = o
  const introduced = [...w.facts.entries()].filter(([, s]) => s.introduced)

  const due = introduced
    .filter(([, s]) => s.due <= day)
    .sort(([ia, a], [ib, b]) => a.due - b.due || a.box - b.box || (ia < ib ? -1 : 1))
    .map(([id]) => id)

  const allowed = newAllowedToday(w, day, o.newCap ?? NEW_CAP, o.pauseNew)
  // 到期的先排，但至少给新事实留两个位置（每个新事实占两次：教完问一次，隔几题再问一次）
  const reserve = Math.min(allowed, 2)
  const dueTake = due.slice(0, Math.max(0, size - reserve * 2))
  const newN = Math.min(allowed, Math.floor((size - dueTake.length) / 2))
  const fresh = nextNewFacts(w, newN)

  const used = new Set([...dueTake, ...fresh])
  const filler = introduced
    .filter(([id, s]) => !used.has(id) && s.box >= 1)
    .sort(([, a], [, b]) => a.due - b.due)
    .slice(0, Math.max(0, size - dueTake.length - fresh.length * 2))
    .map(([id]) => id)

  const mk = (id: string, role: Role): Item => ({
    fact: id,
    qtype: chooseQType(factOf(id), w.facts.get(id), role === 'new', rng),
    role,
    teach: role === 'new',
    scaffold: false,
  })

  const pictures = shuffle(rng, introduced.filter(([id, s]) => !used.has(id) && s.box >= 1 && canPicture(factOf(id))).map(([id]) => id))
    .slice(0, 2)
    .map((id): Item => ({ fact: id, qtype: 'picture', role: 'picture', teach: false, scaffold: false }))

  const pool = shuffle(rng, [...dueTake.map((id) => mk(id, 'due')), ...filler.map((id) => mk(id, 'filler')), ...pictures])
  const items = interleave(pool, fresh.map((id) => mk(id, 'new')), rng)
  return { items, warmups: warmups(w, rng) }
}

/** 自由玩：只出熟了的题（格子 3 以上），不出新的 */
export function buildFree(w: WorldState, rng: Rng, size = DAILY_SIZE): Plan {
  const known = [...w.facts.entries()].filter(([, s]) => s.box >= 3).map(([id]) => id)
  if (!known.length) return { items: [], warmups: [] }
  const ids: string[] = []
  while (ids.length < size) ids.push(...shuffle(rng, known))
  const pool = ids.slice(0, size).map((id): Item => ({
    fact: id, qtype: chooseQType(factOf(id), w.facts.get(id), false, rng), role: 'free', teach: false, scaffold: false,
  }))
  return { items: interleave(pool, [], rng), warmups: [] }
}

export function warmups(w: WorldState, rng: Rng): number[] {
  const one = () => 1 + Math.floor(rng() * 9)
  const two = () => 10 + Math.floor(rng() * 11)
  if (!w.baseline[1].length) return [one(), one(), one(), one(), one(), two(), two(), two()]
  return [one(), two()]
}

/**
 * 排顺序：新事实均匀分布，教完问过后隔 3~4 题再问一次；
 * 尽量不让同一个小伙伴的题挨着。
 */
export function interleave(pool: Item[], fresh: Item[], rng: Rng): Item[] {
  const rest = [...pool]
  const news = [...fresh]
  const pending: { item: Item; at: number }[] = []
  const total = rest.length + news.length * 2
  const spacing = news.length ? Math.max(2, Math.floor(total / news.length)) : Infinity
  let nextNewAt = rest.length ? 1 : 0
  const out: Item[] = []

  for (let i = 0; rest.length || news.length || pending.length; i++) {
    const last = out.length ? companionOf(out[out.length - 1].fact) : ''
    const cands: { item: Item; take: () => void }[] = []
    pending.forEach((p, k) => { if (p.at <= i) cands.push({ item: p.item, take: () => pending.splice(k, 1) }) })
    if (news.length && (i >= nextNewAt || !rest.length)) {
      cands.push({ item: news[0], take: () => { news.shift(); nextNewAt = i + spacing } })
    }
    // 剩得多的小伙伴先出，免得最后只剩同一个小伙伴的题挨着
    const counts = new Map<string, number>()
    for (const it of rest) counts.set(companionOf(it.fact), (counts.get(companionOf(it.fact)) ?? 0) + 1)
    rest
      .map((it, k) => ({ it, k, n: counts.get(companionOf(it.fact))! }))
      .sort((x, y) => y.n - x.n || x.k - y.k)
      .forEach(({ it, k }) => cands.push({ item: it, take: () => rest.splice(k, 1) }))
    if (!cands.length) {
      // 只剩没到点的再问，提前拿出来；不拿刚问过的那道
      pending.sort((x, y) => x.at - y.at)
      const lastFact = out[out.length - 1]?.fact
      const k = Math.max(0, pending.findIndex((p) => p.item.fact !== lastFact))
      cands.push({ item: pending[k].item, take: () => pending.splice(k, 1) })
    }
    const c = cands.find((x) => companionOf(x.item.fact) !== last) ?? cands[0]
    c.take()
    out.push(c.item)
    if (c.item.role === 'new') {
      const again: Item = {
        ...c.item, role: 'again', teach: false,
        qtype: chooseQType(factOf(c.item.fact), { ...emptyState(), box: 1 }, false, rng),
      }
      pending.push({ item: again, at: i + 3 + Math.floor(rng() * 2) })
    }
  }
  return out
}

/** 答错后：隔 2~4 题再问一次 */
export function insertRetry(queue: Item[], pos: number, item: Item, rng: Rng): Item[] {
  const at = Math.min(queue.length, pos + 1 + 2 + Math.floor(rng() * 3))
  const q = [...queue]
  q.splice(at, 0, { ...item, role: 'retry', teach: false })
  return q
}

export const MAX_RETRIES = 2
