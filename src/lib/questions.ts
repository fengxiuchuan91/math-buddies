// 把一个事实变成一道具体的题：选题型、出题面、算答案、配读法。

import { fact as factOf, type Fact } from './facts'
import type { QType } from './events'
import type { FactState } from './schedule'
import { pick, type Rng } from './rng'

export type Cell = 'a' | 'b' | 'x' | ''

export type Visual =
  | { kind: 'frames'; cells: Cell[] }
  | { kind: 'dice'; n: number }
  | { kind: 'bond'; whole: number | null; left: number | null; right: number | null }
  | { kind: 'line'; nums: (number | null)[] }
  | { kind: 'sticks'; tens: number; ones: number }
  | { kind: 'picture'; a: number; b: number; op: '+' | '-' }

export type Input = 'keypad' | 'compare' | 'picture'

export interface Question {
  fact: string
  qtype: QType
  /** 题面，□ 是要填的空 */
  text: string
  visual?: Visual
  input: Input
  /** keypad：数；compare：> < =；picture：运算符加得数，如 +13 */
  answer: number | string
  speech: string
  /** 一眼看出：图只亮这么久 */
  flashMs?: number
}

export const QTYPE_HINT: Record<QType, string> = {
  result: '算一算，等于几？',
  missing: '方框里填几？',
  bond: '分与合，空着的是几？',
  compare: '比一比，选大于、小于还是等于。',
  see: '看一眼，有几个？',
  ordNext: '数一数，空着的是几？',
  ordPrev: '数一数，空着的是几？',
  ordLine: '数一数，空着的是几？',
  ordCompare: '比一比，哪个大？',
  teenMake: '几个十和几个一，合起来是几？',
  teenSplit: '这个数里有几个十、几个一？',
  picture: '看图，先选加还是减，再算出来。',
}

const M = '−'
const opText = (k: Fact['kind']) => (k === 'sub' ? M : '+')
const opSay = (k: Fact['kind']) => (k === 'sub' ? '减' : '加')

export function chooseQType(f: Fact, s: FactState | undefined, isNew: boolean, rng: Rng): QType {
  switch (f.kind) {
    case 'see': return 'see'
    case 'teen': return isNew ? 'teenMake' : pick(rng, ['teenMake', 'teenSplit'] as const)
    case 'ord': {
      if (isNew) return 'ordLine'
      return pick(rng, ['ordNext', 'ordPrev', 'ordLine', 'ordCompare'] as const)
    }
    default: {
      if (isNew || !s || s.box < 1) return 'result'
      const opts: QType[] = ['result', 'result', 'missing', 'compare']
      if (f.kind === 'add' && f.answer <= 10) opts.push('bond')
      if (f.kind === 'sub' && f.a <= 10) opts.push('bond')
      return pick(rng, opts)
    }
  }
}

export const canPicture = (f: Fact) => (f.kind === 'add' || f.kind === 'sub') && f.a > 0 && f.b > 0 && f.a <= 10 && f.b <= 10

const cmp = (x: number, y: number) => (x > y ? '>' : x < y ? '<' : '=')
const cmpSay = { '>': '大于', '<': '小于', '=': '等于' } as const

export function makeQuestion(factId: string, qtype: QType, rng: Rng): Question {
  const f = factOf(factId)
  const { a, b, answer: n } = f
  const base = { fact: factId, qtype }
  const eq = `${a} ${opText(f.kind)} ${b}`
  const eqSay = `${a}${opSay(f.kind)}${b}`
  switch (qtype) {
    case 'result':
      return { ...base, text: `${eq} = □`, input: 'keypad', answer: n, speech: `${eqSay}等于几？` }
    case 'missing': {
      const left = rng() < 0.5
      if (f.kind === 'add') {
        return left
          ? { ...base, text: `□ + ${b} = ${n}`, input: 'keypad', answer: a, speech: `几加${b}等于${n}？` }
          : { ...base, text: `${a} + □ = ${n}`, input: 'keypad', answer: b, speech: `${a}加几等于${n}？` }
      }
      return left
        ? { ...base, text: `□ ${M} ${b} = ${n}`, input: 'keypad', answer: a, speech: `几减${b}等于${n}？` }
        : { ...base, text: `${a} ${M} □ = ${n}`, input: 'keypad', answer: b, speech: `${a}减几等于${n}？` }
    }
    case 'bond': {
      if (f.kind === 'add') {
        return rng() < 0.5
          ? { ...base, text: `${n} 分成 ${a} 和 □`, visual: { kind: 'bond', whole: n, left: a, right: null }, input: 'keypad', answer: b, speech: `${n}分成${a}和几？` }
          : { ...base, text: `${a} 和 ${b} 合成 □`, visual: { kind: 'bond', whole: null, left: a, right: b }, input: 'keypad', answer: n, speech: `${a}和${b}合成几？` }
      }
      return { ...base, text: `${a} 分成 ${b} 和 □`, visual: { kind: 'bond', whole: a, left: b, right: null }, input: 'keypad', answer: n, speech: `${a}分成${b}和几？` }
    }
    case 'compare': {
      const k = Math.max(0, n + pick(rng, [-2, -1, 0, 1, 2]))
      return { ...base, text: `${eq} ○ ${k}`, input: 'compare', answer: cmp(n, k), speech: `${eqSay}，和${k}比，填大于、小于还是等于？` }
    }
    case 'picture': {
      const op = f.kind === 'sub' ? '-' : '+'
      const speech = op === '+' ? `原来有${a}个，又来了${b}个，一共有几个？` : `原来有${a}个，走了${b}个，还剩几个？`
      return { ...base, text: `${a} ○ ${b} = □`, visual: { kind: 'picture', a, b, op }, input: 'picture', answer: `${op}${n}`, speech }
    }
    case 'see': {
      const visual: Visual = n <= 6 && rng() < 0.5 ? { kind: 'dice', n } : { kind: 'frames', cells: cells([[n, 'a']], 10) }
      return { ...base, text: '有几个？', visual, input: 'keypad', answer: n, speech: '看一眼，有几个？', flashMs: 1200 }
    }
    case 'ordNext':
      if (n === 0) return makeQuestion(factId, 'ordPrev', rng)
      return { ...base, text: `${n - 1} 后面是 □`, input: 'keypad', answer: n, speech: `${n - 1}后面是几？` }
    case 'ordPrev':
      if (n === 20) return makeQuestion(factId, 'ordNext', rng)
      return { ...base, text: `${n + 1} 前面是 □`, input: 'keypad', answer: n, speech: `${n + 1}前面是几？` }
    case 'ordLine': {
      const lo = Math.max(0, Math.min(n - 2, 16))
      const nums = [0, 1, 2, 3, 4].map((i) => lo + i).map((x) => (x === n ? null : x))
      return { ...base, text: '空着的是几？', visual: { kind: 'line', nums }, input: 'keypad', answer: n, speech: '数一数，空着的是几？' }
    }
    case 'ordCompare': {
      let m = n + pick(rng, [-3, -2, -1, 1, 2, 3])
      if (m < 0 || m > 20) m = n <= 10 ? n + 2 : n - 2
      const c = cmp(n, m)
      return { ...base, text: `${n} ○ ${m}`, input: 'compare', answer: c, speech: `${n}和${m}，哪个大？` }
    }
    case 'teenMake': {
      const tens = Math.floor(n / 10), ones = n % 10
      const text = ones ? `${tens} 个十和 ${ones} 个一是 □` : `${tens} 个十是 □`
      const speech = ones ? `${tens}个十和${ones}个一是几？` : `${tens}个十是几？`
      return { ...base, text, visual: { kind: 'sticks', tens, ones }, input: 'keypad', answer: n, speech }
    }
    case 'teenSplit': {
      if (n === 20) return { ...base, text: '20 里有 □ 个十', input: 'keypad', answer: 2, speech: '20里有几个十？' }
      return { ...base, text: `${n} 里有 1 个十和 □ 个一`, input: 'keypad', answer: n - 10, speech: `${n}里有1个十和几个一？` }
    }
  }
}

/** 按顺序铺格子：[[3, 'a'], [2, 'b']] → a a a b b，再补空格到 size */
export function cells(groups: [number, Cell][], size: number): Cell[] {
  const out: Cell[] = []
  for (const [k, c] of groups) for (let i = 0; i < k; i++) out.push(c)
  while (out.length < size) out.push('')
  return out
}

export function isRight(q: Question, given: number | string): boolean {
  return String(given) === String(q.answer)
}
