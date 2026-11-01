// 第一次用时的摸底：约 30 题，定每个事实从哪个格子开始。

import { COMPANIONS, FACTS } from './facts'
import type { QType } from './events'
import { pick, shuffle, type Rng } from './rng'

export type PlacementGroup = 'see' | 'dino' | 'make10' | 'ord' | 'teen' | 'site'

export interface PlacementItem {
  fact: string
  qtype: QType
  group: PlacementGroup
}

export interface PlacementResult {
  fact: string
  correct: boolean
  fluent: boolean
}

/** 一类题错到这么多就停这一类 */
export const STOP_AFTER_WRONG = 3

export const BOX_FLUENT = 4
export const BOX_SLOW = 1
export const BOX_INFERRED = 3

const nonZero = (id: string) => {
  const f = FACTS.get(id)!
  return f.a !== 0 && f.b !== 0 && f.answer !== 0
}

/** 从易到难排，让他先答对几道 */
export function placementItems(rng: Rng): PlacementItem[] {
  const items: PlacementItem[] = []
  const take = (ids: string[], k: number, group: PlacementGroup, qtype: QType) => {
    for (const id of shuffle(rng, ids).slice(0, k)) items.push({ fact: id, qtype, group })
  }
  take(['see:2', 'see:3', 'see:4', 'see:5', 'see:6', 'see:7', 'see:8', 'see:9'], 4, 'see', 'see')
  for (let n = 2; n <= 9; n++) {
    const c = COMPANIONS.find((x) => x.id === `dino-${n}`)!
    take(c.facts.filter(nonZero), 2, 'dino', 'result')
  }
  take(COMPANIONS.find((x) => x.id === 'dino-10')!.facts.filter(nonZero), 3, 'make10', 'result')
  take(['ord:7', 'ord:12', 'ord:15', 'ord:18'], 2, 'ord', 'ordLine')
  take(['teen:12', 'teen:14', 'teen:17', 'teen:19'], 2, 'teen', 'teenMake')
  for (const id of ['site-add9', 'site-add8', 'site-add7', 'site-sub9', 'site-sub8']) {
    const c = COMPANIONS.find((x) => x.id === id)!
    items.push({ fact: pick(rng, c.facts), qtype: 'result', group: 'site' })
  }
  return items
}

/** 这一类错够了，后面的跳过 */
export function shouldSkip(item: PlacementItem, wrongByGroup: Partial<Record<PlacementGroup, number>>): boolean {
  return (wrongByGroup[item.group] ?? 0) >= STOP_AFTER_WRONG
}

/**
 * 答对且熟练 → 格子 4；答对但慢 → 格子 1；答错 → 从头来。
 * 一只小伙伴抽到的题（至少 2 道）全部熟练，它没考到的事实放格子 3，之后靠复习验证。
 */
export function placementBoxes(results: PlacementResult[]): Record<string, number> {
  const boxes: Record<string, number> = {}
  const byCompanion = new Map<string, PlacementResult[]>()
  for (const r of results) {
    const f = FACTS.get(r.fact)
    if (!f) continue
    boxes[r.fact] = r.correct ? (r.fluent ? BOX_FLUENT : BOX_SLOW) : 0
    const list = byCompanion.get(f.companion) ?? []
    list.push(r)
    byCompanion.set(f.companion, list)
  }
  for (const [cid, rs] of byCompanion) {
    if (rs.length < 2 || !rs.every((r) => r.correct && r.fluent)) continue
    const c = COMPANIONS.find((x) => x.id === cid)!
    for (const id of c.facts) if (!(id in boxes)) boxes[id] = BOX_INFERRED
  }
  return boxes
}
