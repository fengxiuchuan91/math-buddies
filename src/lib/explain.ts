// 讲解：新事实先演示，答错后再演示。每步一张图、一句话。

import { crossesTen, fact as factOf } from './facts'
import { cells, type Cell, type Visual } from './questions'

export interface Step {
  visual: Visual
  text: string
}

const frames = (...groups: [number, Cell][]): Visual => {
  const n = groups.reduce((s, [k]) => s + k, 0)
  return { kind: 'frames', cells: cells(groups, n > 10 ? 20 : 10) }
}

/** 一句话里的符号换成读法 */
export const say = (text: string) =>
  text.replace(/−/g, '减').replace(/\+/g, '加').replace(/=/g, '等于').replace(/\s+/g, '')

export function explain(factId: string): Step[] {
  const f = factOf(factId)
  const { a, b, answer: n } = f
  switch (f.kind) {
    case 'see':
      return n > 5
        ? [{ visual: frames([n, 'a']), text: `上面一排满了是 5，下面还有 ${n - 5} 个，5 和 ${n - 5} 合成 ${n}` }]
        : [{ visual: frames([n, 'a']), text: `一共 ${n} 个` }]
    case 'ord': {
      const lo = Math.max(0, Math.min(n - 2, 16))
      const nums = [0, 1, 2, 3, 4].map((i) => lo + i)
      const parts = [n > 0 ? `${n} 前面是 ${n - 1}` : '', n < 20 ? `${n} 后面是 ${n + 1}` : ''].filter(Boolean)
      return [{ visual: { kind: 'line', nums }, text: parts.join('，') }]
    }
    case 'teen': {
      const tens = Math.floor(n / 10), ones = n % 10
      return [{ visual: { kind: 'sticks', tens, ones }, text: ones ? `1 捆是 1 个十，再加 ${ones} 根，是 ${n}` : `2 捆是 2 个十，是 20` }]
    }
    case 'add': {
      if (crossesTen(f)) {
        // 凑十法：拆小的数，凑大的数
        const big = Math.max(a, b), small = Math.min(a, b)
        const need = 10 - big, left = small - need
        return [
          { visual: frames([big, 'a'], [small, 'b']), text: `${big} 和 ${small}，先看 ${big} 还差几个凑成 10` },
          { visual: frames([big, 'a'], [need, 'b']), text: `${big} 还差 ${need} 个，把 ${small} 分成 ${need} 和 ${left}` },
          { visual: frames([10, 'a'], [left, 'b']), text: `${big} + ${need} = 10，10 + ${left} = ${n}` },
        ]
      }
      if (a >= 10 || b >= 10) {
        const ten = a >= 10 ? a : b, other = a >= 10 ? b : a
        const ones = ten - 10
        if (!ones) return [{ visual: frames([10, 'a'], [other, 'b']), text: `1 个十和 ${other} 个一，合起来是 ${n}` }]
        return [
          { visual: frames([10, 'a'], [ones, 'a'], [other, 'b']), text: `${ten} 是 1 个十和 ${ones} 个一` },
          { visual: frames([10, 'a'], [ones + other, 'b']), text: `${ones} + ${other} = ${ones + other}，再和 10 合起来是 ${n}` },
        ]
      }
      return [
        { visual: frames([a, 'a'], [b, 'b']), text: `${a} 和 ${b} 合起来是 ${n}，${a} + ${b} = ${n}` },
      ]
    }
    case 'sub': {
      if (crossesTen(f)) {
        // 破十法：从 10 里减，再和剩下的合起来
        const ones = a - 10
        return [
          { visual: frames([10, 'a'], [ones, 'a']), text: `${a} 是 10 和 ${ones}。${ones} 个不够减 ${b}` },
          { visual: frames([b, 'x'], [10 - b, 'a'], [ones, 'a']), text: `从 10 里减 ${b}，10 − ${b} = ${10 - b}` },
          { visual: frames([10 - b, 'a'], [ones, 'a']), text: `${10 - b} + ${ones} = ${n}。也可以想：${b} + ${n} = ${a}` },
        ]
      }
      if (a > 10) {
        const ones = a - 10
        if (b === 10) {
          return [{ visual: frames([10, 'x'], [ones, 'a']), text: `${a} 是 10 和 ${ones}，去掉 10，还剩 ${ones}` }]
        }
        return [{ visual: frames([10, 'a'], [b, 'x'], [ones - b, 'a']), text: `${a} 是 10 和 ${ones}。${ones} − ${b} = ${ones - b}，再和 10 合起来是 ${n}` }]
      }
      return [
        { visual: frames([b, 'x'], [n, 'a']), text: `${a} 个去掉 ${b} 个，还剩 ${n} 个，${a} − ${b} = ${n}` },
        ...(b > 0 && n > 0 ? [{ visual: { kind: 'bond', whole: a, left: b, right: n } as Visual, text: `也可以想：${b} 加几等于 ${a}？${b} + ${n} = ${a}` }] : []),
      ]
    }
  }
}
