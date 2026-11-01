// 家长录音清单（词表）和分词：把一句要读的话拆成若干条录音，按顺序拼着放。
// 清单要覆盖游戏里所有会读出来的话，见 tests/speech.test.ts。

import { PHRASES, PRAISE } from './phrases'
import { QTYPE_HINT } from './questions'
import { COMPANIONS } from './facts'

export type VocabGroup = '必需' | '讲解' | '鼓励' | '名字'

export interface VocabEntry {
  id: string
  text: string
  group: VocabGroup
}

export type Segment = { kind: 'clip'; id: string } | { kind: 'pause'; ms: number }

/** 孩子称呼那一条的编号，内容由 setVoiceName 设置 */
export const NAME_ID = 'name'

/** 标点处停一下；顿号短一点 */
const PAUSE: Record<string, number> = { '，': 250, '。': 250, '？': 250, '！': 250, '：': 250, '、': 150 }

/** 去空格、半角标点换成全角，录音清单和要读的话都先过一遍，两边才对得上 */
export function normalize(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/,/g, '，').replace(/\./g, '。').replace(/\?/g, '？').replace(/!/g, '！').replace(/:/g, '：')
}

/** 清单里的条目去掉结尾标点再匹配：结尾的停顿由句子自己的标点给 */
const key = (text: string) => normalize(text).replace(/[，。？！：、]+$/, '')

// 0~21 每个数一条：比大小会出“10加9和21比”。数在句子里整段匹配，13 不会被拆成 1 和 3
const NUMBERS: VocabEntry[] = Array.from({ length: 22 }, (_, n) => ({ id: `n${n}`, text: String(n), group: '必需' }))

// 算式和题目里拼出来的词。只收拼题必需的，家长少录几条
const WORDS = [
  '加', '减', '等于', '几', '和', '比', '是', '个', '分成', '合成', '个十', '个一', '里有',
  '前面', '后面', '哪个大', '填大于、小于还是等于', '原来有', '又来了', '一共有', '走了', '还剩',
]

// 讲解里拼出来的固定说法（凑十、破十、想加算减）
const EXPLAIN = [
  '上面一排满了是', '下面还有', '一共', '捆是', '再加', '根', '先看', '还差几个凑成', '还差', '把',
  '合起来是', '再和', '不够', '从', '里', '也可以想', '去掉',
]

function phraseGroup(k: keyof typeof PHRASES): VocabGroup {
  if (['teachIntro', 'explainIntro', 'fixPrompt', 'fixOk'].includes(k)) return '讲解'
  if (['warmup', 'pickOp', 'placementWrong'].includes(k)) return '必需'
  return '鼓励'
}

/** 整条录音：小伙伴的名字连着它管的本领，点卡片时读 */
const companionLine = (c: { name: string; skill: string }) => `${c.name}，${c.skill}`

export function buildVocab(childName = ''): VocabEntry[] {
  const out: VocabEntry[] = []
  const seen = new Set<string>()
  const add = (e: VocabEntry) => {
    const k = key(e.text)
    if (e.id !== NAME_ID && (!k || seen.has(k))) return
    if (k) seen.add(k)
    out.push(e)
  }
  NUMBERS.forEach(add)
  WORDS.forEach((t) => add({ id: `w:${t}`, text: t, group: '必需' }))
  // 题型提示语整句录，一天里每种题第一次出现时读
  const hints = new Map<string, string>()
  for (const [qt, t] of Object.entries(QTYPE_HINT)) if (!hints.has(t)) hints.set(t, qt)
  for (const [t, qt] of hints) add({ id: `hint:${qt}`, text: t, group: '必需' })
  for (const k of Object.keys(PHRASES) as (keyof typeof PHRASES)[]) add({ id: `phrase:${k}`, text: PHRASES[k], group: phraseGroup(k) })
  EXPLAIN.forEach((t) => add({ id: `x:${t}`, text: t, group: '讲解' }))
  PRAISE.forEach((t, i) => add({ id: `praise:${i}`, text: t, group: '鼓励' }))
  add({ id: NAME_ID, text: childName.trim(), group: '名字' })
  for (const c of COMPANIONS) add({ id: `c:${c.id}`, text: companionLine(c), group: '名字' })
  return out
}

/**
 * 拆成录音和停顿。用最少的录音条数拼出整句（动态规划），优先用整句录音。
 * 拼不全就返回 null：这句整句交给浏览器朗读，不在一句里混两种声音。
 */
export function tokenize(text: string, vocab: VocabEntry[]): Segment[] | null {
  const s = normalize(text)
  const n = s.length
  if (!n) return []
  const entries = vocab.map((e) => ({ id: e.id, k: key(e.text) })).filter((e) => e.k)
  const isDigit = (i: number) => i >= 0 && i < n && s[i] >= '0' && s[i] <= '9'

  // cost[i]：从 i 拼到结尾最少几条录音；choice[i]：在 i 处怎么走
  const cost = new Array<number>(n + 1).fill(Infinity)
  const choice = new Array<Segment & { len: number } | null>(n + 1).fill(null)
  cost[n] = 0
  for (let i = n - 1; i >= 0; i--) {
    // 不能从一串数字的中间开始
    if (isDigit(i) && isDigit(i - 1)) continue
    const ch = s[i]
    if (PAUSE[ch] !== undefined) {
      if (cost[i + 1] < cost[i]) { cost[i] = cost[i + 1]; choice[i] = { kind: 'pause', ms: PAUSE[ch], len: 1 } }
      continue
    }
    for (const e of entries) {
      const L = e.k.length
      if (!s.startsWith(e.k, i)) continue
      // 匹配到的末尾不能切在一串数字中间（"1" 不能吃掉 "13" 的一半）
      if (isDigit(i + L - 1) && isDigit(i + L)) continue
      const c = 1 + cost[i + L]
      // 同样条数时取更长的，前面先用上整句
      if (c < cost[i] || (c === cost[i] && choice[i]?.kind === 'clip' && L > choice[i]!.len)) {
        cost[i] = c
        choice[i] = { kind: 'clip', id: e.id, len: L }
      }
    }
  }
  if (cost[0] === Infinity) return null

  const out: Segment[] = []
  for (let i = 0; i < n;) {
    const c = choice[i]!
    if (c.kind === 'pause') {
      const last = out[out.length - 1]
      if (last?.kind === 'pause') last.ms = Math.max(last.ms, c.ms)
      else out.push({ kind: 'pause', ms: c.ms })
    } else {
      out.push({ kind: 'clip', id: c.id })
    }
    i += c.len
  }
  // 开头结尾的停顿没用，只会拖慢 onEnd
  while (out[0]?.kind === 'pause') out.shift()
  while (out[out.length - 1]?.kind === 'pause') out.pop()
  return out
}
