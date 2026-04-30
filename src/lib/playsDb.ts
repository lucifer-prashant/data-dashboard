import type { PlayRecord } from './spotify'

const DB_NAME = 'dashboard'
const STORE = 'plays'
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'playedAt' })
        store.createIndex('date', 'date', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function toRecord(p: PlayRecord): PlayRecord & { date: string } {
  return { ...p, date: p.playedAt.split('T')[0] }
}

export async function mergePlays(incoming: PlayRecord[]): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const p of incoming) {
      // put only if not exists — preserves existing, deduplicates by playedAt key
      const check = store.get(p.playedAt)
      check.onsuccess = () => {
        if (!check.result) store.put(toRecord(p))
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPlaysByDateRange(from: string, to: string): Promise<(PlayRecord & { date: string })[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index('date')
    const req = index.getAll(IDBKeyRange.bound(from, to))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getTotalCount(): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
