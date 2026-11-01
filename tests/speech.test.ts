import { describe, expect, it } from 'vitest'
import { COMPANIONS, FACTS, fact } from '../src/lib/facts'
import type { QType } from '../src/lib/events'
import { QTYPE_HINT, makeQuestion } from '../src/lib/questions'
import { explain, say } from '../src/lib/explain'
import { PHRASES, PRAISE } from '../src/lib/phrases'
import { NAME_ID, buildVocab, normalize, tokenize } from '../src/lib/speech'
import { seeded } from '../src/lib/rng'

function qtypesFor(id: string): QType[] {
  const f = fact(id)
  switch (f.kind) {
    case 'see': return ['see']
    case 'ord': return ['ordNext', 'ordPrev', 'ordLine', 'ordCompare']
    case 'teen': return ['teenMake', 'teenSplit']
    default: {
      const t: QType[] = ['result', 'missing', 'compare']
      if (f.a > 0 && f.b > 0 && f.a <= 10 && f.b <= 10) t.push('picture')
      if ((f.kind === 'add' && f.answer <= 10) || (f.kind === 'sub' && f.a <= 10)) t.push('bond')
      return t
    }
  }
}

/** 游戏里所有会读出来的话 */
function allSentences(childName: string): string[] {
  const out = new Set<string>([...Object.values(PHRASES), ...PRAISE, ...Object.values(QTYPE_HINT)])
  for (const id of FACTS.keys()) {
    for (const t of qtypesFor(id)) for (let s = 1; s <= 4; s++) out.add(makeQuestion(id, t, seeded(s)).speech)
    for (const step of explain(id)) {
      out.add(PHRASES.teachIntro + say(step.text))
      out.add(PHRASES.explainIntro + say(step.text))
      out.add(say(step.text))
    }
  }
  for (const c of COMPANIONS) out.add(`${c.name}，${c.skill}`)
  for (const title of [PHRASES.doneDaily, PHRASES.donePlacement, PHRASES.doneFree, PHRASES.doneStopped]) {
    out.add(title)
    if (childName) out.add(`${childName}，${title}`)
  }
  return [...out]
}

describe('录音清单', () => {
  const vocab = buildVocab('豆豆')

  it('覆盖游戏里所有会读出来的话', () => {
    const missing = allSentences('豆豆').filter((t) => tokenize(t, vocab) === null)
    expect(missing).toEqual([])
  })

  it('约 100 条，编号不重复，0~21 每个数一条，有称呼那一条', () => {
    expect(vocab.length).toBeGreaterThanOrEqual(90)
    expect(vocab.length).toBeLessThanOrEqual(125)
    expect(new Set(vocab.map((e) => e.id)).size).toBe(vocab.length)
    for (let n = 0; n <= 21; n++) expect(vocab.some((e) => e.text === String(n))).toBe(true)
    expect(vocab.find((e) => e.id === NAME_ID)).toMatchObject({ text: '豆豆', group: '名字' })
    expect(new Set(vocab.map((e) => e.group))).toEqual(new Set(['必需', '讲解', '鼓励', '名字']))
  })

  it('没有称呼时，称呼那一条留空，不参与拼句', () => {
    const v = buildVocab('')
    expect(v.find((e) => e.id === NAME_ID)!.text).toBe('')
    expect(tokenize('，今天的练习做完了！', v)).not.toBeNull()
  })
})

describe('分词', () => {
  const vocab = buildVocab('豆豆')
  const ids = (t: string) => tokenize(t, vocab)?.map((s) => (s.kind === 'clip' ? vocab.find((e) => e.id === s.id)!.text : `|${s.ms}`))

  it('数整段匹配，13 不拆成 1 和 3', () => {
    expect(ids('8加5等于几？')).toEqual(['8', '加', '5', '等于', '几'])
    expect(ids('13减5等于几？')).toEqual(['13', '减', '5', '等于', '几'])
  })

  it('有整句录音就用整句；标点处停顿，开头结尾不停', () => {
    expect(tokenize(PHRASES.donePlacement, vocab)).toEqual([{ kind: 'clip', id: 'phrase:donePlacement' }])
    expect(ids('豆豆，今天的练习做完了！')).toEqual(['豆豆', '|250', PHRASES.doneDaily])
    expect(ids('原来有3个，又来了2个，一共有几个？')).toEqual(['原来有', '3', '个', '|250', '又来了', '2', '个', '|250', '一共有', '几', '个'])
  })

  it('空格和半角标点不影响', () => {
    expect(normalize(' 8 + 5 , 好 ')).toBe('8+5，好')
    expect(ids('8 加 5 等于几?')).toEqual(['8', '加', '5', '等于', '几'])
  })

  it('拼不全返回 null；21 以上的数没有录音', () => {
    expect(tokenize('8加5等于几', vocab.filter((e) => e.text !== '几'))).toBeNull()
    expect(tokenize('37加1等于几', vocab)).toBeNull()
    expect(tokenize('', vocab)).toEqual([])
  })

  it('只用已录的条目：缺整句录音时退到拼词', () => {
    const recorded = vocab.filter((e) => e.id !== 'c:dino-8')
    const segs = tokenize('8号霸王龙，8的分与合', recorded)
    expect(segs === null || segs.every((s) => s.kind !== 'clip' || s.id !== 'c:dino-8')).toBe(true)
  })
})
