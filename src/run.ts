import type { Mode } from './lib/events'
import type { Item } from './lib/session'
import type { PlacementItem } from './lib/placement'

/** 一次练习：热身、摸底、今日练习或自由玩 */
export interface Run {
  mode: Mode
  session: string
  warmups: number[]
  items: Item[]
  placement?: PlacementItem[]
  /** 自由玩最多多久 */
  freeLimitMs?: number
}

export interface RunResult {
  mode: Mode
  answered: number
  correct: number
  ms: number
  /** 这次照顾到的小伙伴 */
  companions: string[]
  completed: boolean
}
