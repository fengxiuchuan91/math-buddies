// 事件存在设备上（IndexedDB）。同步到服务器是下一步。

import type { MbEvent } from './lib/events'

const DB_NAME = 'math-buddies'
const STORE = 'events'
const LS_KEY = 'mb-events'

let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

// 有的浏览器（无痕模式等）打不开 IndexedDB，退到 localStorage
const lsAll = (): MbEvent[] => JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')

export async function loadEvents(): Promise<MbEvent[]> {
  try {
    const d = await db()
    return await new Promise((resolve, reject) => {
      const r = d.transaction(STORE).objectStore(STORE).getAll()
      r.onsuccess = () => resolve(r.result as MbEvent[])
      r.onerror = () => reject(r.error)
    })
  } catch {
    return lsAll()
  }
}

export async function saveEvent(e: MbEvent): Promise<void> {
  try {
    const d = await db()
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(e)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    localStorage.setItem(LS_KEY, JSON.stringify([...lsAll(), e]))
  }
}
