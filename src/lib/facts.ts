// 事实表与小伙伴。顺序即出新顺序（人教版一年级上、下册）。

export type World = 'park' | 'dino' | 'site'
export type FactKind = 'add' | 'sub' | 'see' | 'ord' | 'teen'

export interface Fact {
  id: string
  kind: FactKind
  a: number
  b: number
  answer: number
  companion: string
}

export interface Companion {
  id: string
  world: World
  name: string
  skill: string
  facts: string[]
}

const add = (a: number, b: number) => `${a}+${b}`
const sub = (a: number, b: number) => `${a}-${b}`

const factMap = new Map<string, Fact>()
const companionList: Companion[] = []

function addFact(companion: string, kind: FactKind, a: number, b: number, answer: number, id: string) {
  if (factMap.has(id)) return
  factMap.set(id, { id, kind, a, b, answer, companion })
  companionList[companionList.length - 1].facts.push(id)
}

function companion(id: string, world: World, name: string, skill: string, fill: () => void) {
  companionList.push({ id, world, name, skill, facts: [] })
  fill()
}

const pushAdd = (c: string, a: number, b: number) => addFact(c, 'add', a, b, a + b, add(a, b))
const pushSub = (c: string, a: number, b: number) => addFact(c, 'sub', a, b, a - b, sub(a, b))

// 动物乐园：数感
companion('park-see', 'park', '猫头鹰', '一眼看出', () => {
  for (const n of [3, 2, 4, 5, 1, 6, 7, 8, 9, 10]) addFact('park-see', 'see', n, 0, n, `see:${n}`)
})
companion('park-ord', 'park', '小兔子', '数的顺序', () => {
  for (let n = 0; n <= 20; n++) addFact('park-ord', 'ord', n, 0, n, `ord:${n}`)
})
companion('park-teen', 'park', '小松鼠', '十几的组成', () => {
  for (let n = 11; n <= 20; n++) addFact('park-teen', 'teen', n, 0, n, `teen:${n}`)
})

// 恐龙岛：n 号恐龙管 n 的分合，和是 n 的加法、从 n 减的减法。0 和 1 归 2 号
const dinoNames: Record<number, string> = {
  2: '甲龙', 3: '三角龙', 4: '剑龙', 5: '腕龙', 6: '翼龙', 7: '迅猛龙', 8: '霸王龙', 9: '副栉龙', 10: '凑十龙',
}
for (let n = 2; n <= 10; n++) {
  const c = `dino-${n}`
  companion(c, 'dino', `${n} 号${dinoNames[n]}`, `${n} 的分与合`, () => {
    // 先成对的分法（1 和 n−1），带 0 的放最后
    for (let a = 1; a <= Math.floor(n / 2); a++) {
      const b = n - a
      pushAdd(c, a, b); pushAdd(c, b, a); pushSub(c, n, a); pushSub(c, n, b)
    }
    pushAdd(c, n, 0); pushAdd(c, 0, n); pushSub(c, n, 0); pushSub(c, n, n)
    if (n === 2) {
      pushAdd(c, 1, 0); pushAdd(c, 0, 1); pushSub(c, 1, 0); pushSub(c, 1, 1)
    }
  })
}

// 工地：20 以内
companion('site-flat', 'site', '压路机', '不进位不退位', () => {
  for (let a = 1; a <= 9; a++) pushAdd('site-flat', 10, a)
  for (let a = 1; a <= 9; a++) pushSub('site-flat', 10 + a, a)
  for (let a = 1; a <= 9; a++) pushSub('site-flat', 10 + a, 10)
  for (const [a, b] of [[12, 3], [13, 5], [14, 4]] as const) pushAdd('site-flat', a, b)
  for (const [a, b] of [[15, 3], [17, 4], [19, 6]] as const) pushSub('site-flat', a, b)
})
// 进位加按第一个加数分组，与教材“9 加几、8 加几……”一致
const carryGroups: [string, string, number[]][] = [
  ['site-add9', '挖掘机', [9]],
  ['site-add8', '吊车', [8]],
  ['site-add7', '推土机', [7]],
  ['site-add6', '搅拌车', [6]],
  ['site-add5432', '自卸车', [5, 4, 3, 2]],
]
for (const [id, name, firsts] of carryGroups) {
  companion(id, 'site', name, `${firsts.join('、')} 加几`, () => {
    for (const a of firsts) for (let b = 2; b <= 9; b++) if (a + b > 10) pushAdd(id, a, b)
  })
}
// 退位减按减数分组，与教材“十几减 9、十几减 8……”一致
const borrowGroups: [string, string, number[]][] = [
  ['site-sub9', '消防车', [9]],
  ['site-sub8', '叉车', [8]],
  ['site-sub76', '装载机', [7, 6]],
  ['site-sub5432', '拖拉机', [5, 4, 3, 2]],
]
for (const [id, name, subs] of borrowGroups) {
  companion(id, 'site', name, `十几减 ${subs.join('、')}`, () => {
    for (const b of subs) for (let m = 11; m <= 18; m++) if (m - b < 10 && m - b > 0) pushSub(id, m, b)
  })
}

export const FACTS: ReadonlyMap<string, Fact> = factMap
export const COMPANIONS: readonly Companion[] = companionList
export const COMPANION_BY_ID: ReadonlyMap<string, Companion> = new Map(companionList.map((c) => [c.id, c]))

export function fact(id: string): Fact {
  const f = factMap.get(id)
  if (!f) throw new Error(`unknown fact ${id}`)
  return f
}

/** 这个事实是否属于 20 以内的进位加或退位减 */
export function crossesTen(f: Fact): boolean {
  if (f.kind === 'add') return f.a < 10 && f.b < 10 && f.answer > 10
  if (f.kind === 'sub') return f.a > 10 && f.a < 20 && f.b < 10 && f.answer < 10
  return false
}
