// 错法归类，给家长区看他错在哪。

import type { Fact } from './facts'
import type { QType } from './events'

export type ErrorKind = 'off1' | 'wrongOp' | 'forgotCarry' | 'borrowReverse' | 'other'

export const ERROR_NAMES: Record<ErrorKind, string> = {
  off1: '差 1（多半在数手指）',
  wrongOp: '加减看反',
  forgotCarry: '进位忘了',
  borrowReverse: '退位倒着减',
  other: '其他',
}

export function classify(f: Fact, qtype: QType, expected: number | string, given: number | string): ErrorKind {
  const g = Number(given)
  const x = Number(expected)
  if (!Number.isFinite(g) || !Number.isFinite(x)) return 'other'
  if (qtype === 'result' && (f.kind === 'add' || f.kind === 'sub')) {
    const { a, b } = f
    if (f.kind === 'add') {
      // 8+5 答 3：个位对了，十没进上去
      if (a + b > 10 && a < 10 && b < 10 && g === (a + b) % 10) return 'forgotCarry'
      if (g === Math.abs(a - b) && a !== 0 && b !== 0) return 'wrongOp'
    } else {
      const ones = a % 10
      // 13−5 答 12：个位不够减，拿 5 减 3
      if (a > 10 && a < 20 && b < 10 && b > ones && g === 10 + (b - ones)) return 'borrowReverse'
      if (g === a + b && b !== 0) return 'wrongOp'
    }
  }
  if (Math.abs(g - x) === 1) return 'off1'
  return 'other'
}
