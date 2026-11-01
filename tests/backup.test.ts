import { describe, expect, it } from 'vitest'
import { backupFileName, buildBackup, parseBackup, type Codec } from '../src/lib/backup'
import { DEFAULT_SETTINGS } from '../src/settings'
import type { MbEvent } from '../src/lib/events'
import { D, answer, at, placement, session } from './helpers'

const codec: Codec = {
  toBase64: async (b) => Buffer.from(await b.arrayBuffer()).toString('base64'),
  fromBase64: (s) => new Blob([Buffer.from(s, 'base64')], { type: 'audio/wav' }),
}

const events: MbEvent[] = [placement(D, { '3+4': 4 }), ...session(D, 'daily', true), answer('3+4', D, true)]
const wav = new Uint8Array([82, 73, 70, 70, 0, 1, 2, 255])

describe('备份', () => {
  it('导出再导入，事件、设置、录音原样回来', async () => {
    const settings = { ...DEFAULT_SETTINGS, childName: '小宝', dailySize: 25 }
    const file = await buildBackup(events, settings, [{ id: 'n8', updated: 123, blob: new Blob([wav]) }], at(D), codec)
    expect(file.version).toBe(1)
    const back = parseBackup(JSON.stringify(file), codec)
    expect(back.events).toEqual(events)
    expect(back.settings).toEqual(settings)
    expect(back.clips).toHaveLength(1)
    expect(back.clips[0]).toMatchObject({ id: 'n8', updated: 123 })
    expect(new Uint8Array(await back.clips[0].blob.arrayBuffer())).toEqual(wav)
  })

  it('同一编号的事件只留一条', async () => {
    const file = await buildBackup([...events, events[0]], DEFAULT_SETTINGS, [], 0, codec)
    expect(parseBackup(JSON.stringify(file), codec).events).toHaveLength(events.length)
  })

  it('设置经过校验：越界的收回范围，不认识的键丢掉', () => {
    const text = JSON.stringify({ version: 1, events: [], clips: [], settings: { dailySize: 999, freeMinutes: -3, evil: 1, childName: 7 } })
    const s = parseBackup(text, codec).settings
    expect(s.dailySize).toBe(40)
    expect(s.freeMinutes).toBe(0)
    expect(s.childName).toBe('')
    expect('evil' in s).toBe(false)
  })

  it.each([
    ['不是 JSON', 'hello', '这不是备份文件'],
    ['版本不对', JSON.stringify({ version: 2, events: [], clips: [] }), '版本不对'],
    ['少了 events', JSON.stringify({ version: 1, clips: [] }), '不完整'],
    ['事件坏了', JSON.stringify({ version: 1, events: [{ id: 1, t: 'x', kind: 'answer' }], clips: [] }), '作答记录有损坏'],
    ['事件种类不认识', JSON.stringify({ version: 1, events: [{ id: 'a', t: 1, kind: 'hack' }], clips: [] }), '作答记录有损坏'],
    ['录音坏了', JSON.stringify({ version: 1, events: [], clips: [{ id: 'a' }] }), '录音有损坏'],
  ])('%s 时拒绝', (_name, text, msg) => {
    expect(() => parseBackup(text, codec)).toThrow(msg)
  })

  it('文件名用北京时间的日期', () => {
    // UTC 16:30 已是北京时间第二天 0:30
    expect(backupFileName(Date.UTC(2026, 10, 1, 16, 30))).toBe('数学小伙伴备份-2026-11-02.json')
  })
})
