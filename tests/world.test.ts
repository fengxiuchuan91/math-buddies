import { describe, expect, it } from 'vitest'
import { COMPANIONS } from '../src/lib/facts'
import { mergeEvents, dayOf, type MbEvent } from '../src/lib/events'
import { dailyDone, openWorlds, recentAccuracy, replay, sleepy, stage } from '../src/lib/world'
import { D, answer, at, byTime, placement, session } from './helpers'

const d3 = COMPANIONS.find((c) => c.id === 'dino-3')!

describe('北京时间的日子', () => {
  it('北京时间 0 点换日', () => {
    expect(dayOf(at(D, 0))).toBe(D)
    expect(dayOf(at(D, 23.99))).toBe(D)
    expect(dayOf(at(D, 24))).toBe(D + 1)
  })
})

describe('事件重算', () => {
  it('两台设备的事件交错合并，与单台按时间做出的结果一致；重复事件只算一次', () => {
    const all: MbEvent[] = []
    for (let d = 0; d < 10; d++) for (const id of d3.facts) all.push(answer(id, D + d, (d + id.length) % 3 !== 0))
    const phone = all.filter((_, i) => i % 2 === 0)
    const pad = all.filter((_, i) => i % 2 === 1)
    const merged = mergeEvents(pad, phone, phone.slice(0, 5))
    expect(merged).toEqual(byTime(all))
    const a = replay(merged)
    const b = replay(byTime(all))
    expect([...a.facts.entries()]).toEqual([...b.facts.entries()])
  })

  it('八成事实到格子 3 时变为长大；之后格子回落，阶段不降', () => {
    const boxes = Object.fromEntries(d3.facts.map((id, i) => [id, i < 6 ? 3 : 1]))
    let w = replay([placement(D, boxes)])
    expect(d3.facts.length).toBe(8)
    expect(stage(w, 'dino-3')).toBe(1) // 6/8 < 八成
    boxes[d3.facts[6]] = 3
    const events: MbEvent[] = [placement(D, boxes)]
    w = replay(events)
    expect(stage(w, 'dino-3')).toBe(2)
    for (const id of d3.facts) events.push(answer(id, D + 4, false))
    w = replay(events)
    expect(w.facts.get(d3.facts[0])!.box).toBe(1)
    expect(stage(w, 'dino-3')).toBe(2)
  })

  it('做完今日练习得 10 颗星，一天只算一次；没做完、自由玩不给', () => {
    const w = replay([
      ...session(D, 'daily', true, 'a'), ...session(D, 'daily', true, 'b'),
      ...session(D + 1, 'daily', false, 'c'), ...session(D + 1, 'free', true, 'd'),
      ...session(D + 2, 'daily', true, 'e'),
    ])
    expect(w.stars).toBe(20)
    expect(dailyDone(w, D)).toBe(true)
    expect(dailyDone(w, D + 1)).toBe(false)
  })

  it('摸底的作答不动格子，格子只由 placement 写入', () => {
    const w = replay([answer('3+4', D, true, { mode: 'placement' }), placement(D, { '3+4': 4 })])
    expect(w.facts.get('3+4')).toMatchObject({ box: 4, attempts: 0 })
    expect(w.placed).toBe(true)
  })

  it('最近两次今日练习的首答正确率，再问不算', () => {
    const es: MbEvent[] = []
    for (const day of [D, D + 1]) {
      es.push(...session(day, 'daily', true).slice(0, 1))
      for (let i = 0; i < 10; i++) es.push(answer(d3.facts[i % 8], day, i < 7))
      es.push(answer(d3.facts[0], day, true, { retry: true }))
    }
    expect(recentAccuracy(replay(es))).toBeCloseTo(0.7)
  })

  it('工地在 10 号恐龙和十几的组成都长大后开放', () => {
    const grow = (cid: string) => Object.fromEntries(COMPANIONS.find((c) => c.id === cid)!.facts.map((id) => [id, 3]))
    expect(openWorlds(replay([placement(D, grow('dino-10'))]))).not.toContain('site')
    expect(openWorlds(replay([placement(D, { ...grow('dino-10'), ...grow('park-teen') })]))).toContain('site')
  })

  it('有事实到期、今天还没练：犯困', () => {
    const w = replay([answer('1+2', D, true)])
    expect(sleepy(w, d3, D)).toBe(false)
    expect(sleepy(w, d3, D + 1)).toBe(true)
  })
})
