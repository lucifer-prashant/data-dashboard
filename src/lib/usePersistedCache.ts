import { useState, useEffect } from 'react'

const TODAY_TTL = 60 * 60 * 1000 // 1 hour — only today's entry re-fetches

export function usePersistedCache<T extends Record<string, unknown>>(
  storageKey: string
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [cache, setCache] = useState<T>(() => {
    if (typeof window === 'undefined') return {} as T
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return {} as T
      const { data, todayTs } = JSON.parse(raw)
      // Expire today's entry if stale so it re-fetches fresh data
      const today = new Date().toISOString().split('T')[0]
      if (Date.now() - todayTs > TODAY_TTL && data[today] !== undefined) {
        delete data[today]
      }
      return data as T
    } catch {
      return {} as T
    }
  })

  useEffect(() => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const todayTs = cache[today] !== undefined ? Date.now() : 0
      localStorage.setItem(storageKey, JSON.stringify({ data: cache, todayTs }))
    } catch {}
  }, [cache, storageKey])

  return [cache, setCache]
}
