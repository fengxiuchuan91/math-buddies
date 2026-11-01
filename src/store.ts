// 数据只存在这台手机上（IndexedDB）：作答事件、家长录音。设置在 settings.ts。
// 第一版不做多设备同步；换手机或换浏览器用家长区的“导出备份 / 恢复备份”。

import type { MbEvent } from './lib/events'

const DB_NAME = 'math-buddies'
const DB_VERSION = 2
const LS_KEY = 'mb-events'

export interface ClipRecord {
  /** 录音清单里的句子编号 */
  id: string
  /** 单声道 16kHz WAV */
  blob: Blob
  updated: number
}

let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains('events')) d.createObjectStore('events', { keyPath: 'id' })
      if (!d.objectStoreNames.contains('clips')) d.createObjectStore('clips', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

async function getAll<T>(store: string): Promise<T[]> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const r = d.transaction(store).objectStore(store).getAll()
    r.onsuccess = () => resolve(r.result as T[])
    r.onerror = () => reject(r.error)
  })
}

async function write(store: string, fn: (s: IDBObjectStore) => void): Promise<void> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite')
    fn(tx.objectStore(store))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 有的浏览器（无痕模式等）打不开 IndexedDB：事件退到 localStorage，录音只留在内存里
const lsAll = (): MbEvent[] => JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
const memClips = new Map<string, ClipRecord>()

export async function loadEvents(): Promise<MbEvent[]> {
  try { return await getAll<MbEvent>('events') } catch { return lsAll() }
}

export async function saveEvent(e: MbEvent): Promise<void> {
  return saveEvents([e])
}

/** 批量写入，按编号覆盖，重复写无害。恢复备份时用 */
export async function saveEvents(es: MbEvent[]): Promise<void> {
  try {
    await write('events', (s) => { for (const e of es) s.put(e) })
  } catch {
    const byId = new Map(lsAll().map((e) => [e.id, e]))
    for (const e of es) byId.set(e.id, e)
    localStorage.setItem(LS_KEY, JSON.stringify([...byId.values()]))
  }
}

export async function listClips(): Promise<ClipRecord[]> {
  try { return await getAll<ClipRecord>('clips') } catch { return [...memClips.values()] }
}

export async function putClip(c: ClipRecord): Promise<void> {
  try { await write('clips', (s) => { s.put(c) }) } catch { memClips.set(c.id, c) }
}

export async function deleteClip(id: string): Promise<void> {
  try { await write('clips', (s) => { s.delete(id) }) } catch { memClips.delete(id) }
}

/** 请浏览器别在空间紧张时清掉这里的数据 */
export async function requestPersist(): Promise<void> {
  try { await navigator.storage?.persist?.() } catch { /* 不支持就算了 */ }
}
