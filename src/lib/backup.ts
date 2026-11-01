// 备份：换手机、换浏览器时用。第一版没有服务器，数据只在这台手机上，丢了就没了。

import type { MbEvent } from './events'
import { normalizeSettings, type Settings } from '../settings'
import type { ClipRecord } from '../store'

export const BACKUP_VERSION = 1

export interface BackupClip {
  id: string
  updated: number
  /** WAV 的 base64 */
  wav: string
}

export interface BackupFile {
  version: 1
  exportedAt: number
  events: MbEvent[]
  settings: Settings
  clips: BackupClip[]
}

/** Blob 与 base64 互转。浏览器和测试各用各的实现 */
export interface Codec {
  toBase64: (b: Blob) => Promise<string>
  fromBase64: (s: string) => Blob
}

export async function buildBackup(events: MbEvent[], settings: Settings, clips: ClipRecord[], now: number, codec: Codec): Promise<BackupFile> {
  return {
    version: BACKUP_VERSION,
    exportedAt: now,
    events,
    settings,
    clips: await Promise.all(clips.map(async (c) => ({ id: c.id, updated: c.updated, wav: await codec.toBase64(c.blob) }))),
  }
}

export interface ParsedBackup {
  events: MbEvent[]
  settings: Settings
  clips: ClipRecord[]
}

const KINDS = new Set(['answer', 'session_start', 'session_end', 'placement', 'baseline'])
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

function isEvent(x: unknown): x is MbEvent {
  return isObj(x) && typeof x.id === 'string' && x.id.length > 0 && typeof x.t === 'number' && Number.isFinite(x.t) && KINDS.has(x.kind as string)
}

/** 校验不过就抛错，错误信息直接给家长看 */
export function parseBackup(text: string, codec: Codec): ParsedBackup {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('这不是备份文件') }
  if (!isObj(raw)) throw new Error('这不是备份文件')
  if (raw.version !== BACKUP_VERSION) throw new Error('备份文件的版本不对')
  if (!Array.isArray(raw.events) || !Array.isArray(raw.clips)) throw new Error('备份文件不完整')
  if (!raw.events.every(isEvent)) throw new Error('备份里的作答记录有损坏')

  const byId = new Map<string, MbEvent>()
  for (const e of raw.events) if (!byId.has(e.id)) byId.set(e.id, e)

  const clips: ClipRecord[] = []
  for (const c of raw.clips) {
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.wav !== 'string' || typeof c.updated !== 'number') {
      throw new Error('备份里的录音有损坏')
    }
    clips.push({ id: c.id, updated: c.updated, blob: codec.fromBase64(c.wav) })
  }
  return { events: [...byId.values()], settings: normalizeSettings(raw.settings), clips }
}

/** 文件名带北京时间的日期 */
export function backupFileName(now: number): string {
  return `数学小伙伴备份-${new Date(now + 8 * 3_600_000).toISOString().slice(0, 10)}.json`
}

/** 浏览器里的实现 */
export const browserCodec: Codec = {
  async toBase64(b) {
    const bytes = new Uint8Array(await b.arrayBuffer())
    let s = ''
    // 分段拼，避免大数组一次展开撑爆调用栈
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s)
  },
  fromBase64(s) {
    const bin = atob(s)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: 'audio/wav' })
  },
}
