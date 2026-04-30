"use client"

import { useEffect, useMemo, useCallback } from "react"
import { useState } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { getGoogleFitSteps } from "@/lib/google"
import { usePersistedCache } from "@/lib/usePersistedCache"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

interface Props {
  accessToken: string
  isDark: boolean
}

const ACCENT = "#34d399"
const GOAL = 10000

export default function GoogleFitWidget({ accessToken, isDark }: Props) {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = usePersistedCache<Record<string, number>>("fit_steps")

  const rangeDays = useMemo(() => ({ "7d": 7, "30d": 30, "90d": 90 }[range]), [range])

  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    end.setDate(end.getDate() - rangeDays * offset)
    const start = new Date(end)
    start.setDate(end.getDate() - rangeDays)
    start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate: end }
  }, [rangeDays, offset])

  const chartData = useMemo(() => {
    const all: { date: string; steps: number }[] = []
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0]
      all.push({ date: key, steps: cache[key] ?? 0 })
    }
    return all
  }, [cache, startDate, endDate])

  const isWindowCached = useMemo(() => {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (cache[d.toISOString().split("T")[0]] === undefined) return false
    }
    return true
  }, [cache, startDate, endDate])

  const retry = useCallback(() => {
    setError(null)
    setCache(prev => {
      const next = { ...prev }
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        delete next[d.toISOString().split("T")[0]]
      }
      return next
    })
  }, [startDate, endDate])

  const fetchAndMerge = useCallback(async (start: Date, end: Date) => {
    try {
      const result = await getGoogleFitSteps(accessToken, start, end)
      setCache(prev => {
        const next = { ...prev }
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const k = d.toISOString().split("T")[0]
          if (next[k] === undefined) next[k] = 0
        }
        result.forEach(item => { next[item.date] = item.steps })
        return next
      })
      return true
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || "Unknown error")
      return false
    }
  }, [accessToken])

  useEffect(() => {
    if (isWindowCached) return
    setLoading(true)
    fetchAndMerge(startDate, endDate).finally(() => setLoading(false))
  }, [fetchAndMerge, startDate, endDate, isWindowCached])

  useEffect(() => {
    const prefetch = (off: number) => {
      const pe = new Date(); pe.setHours(23, 59, 59, 999); pe.setDate(pe.getDate() - rangeDays * off)
      const ps = new Date(pe); ps.setDate(pe.getDate() - rangeDays); ps.setHours(0, 0, 0, 0)
      for (let d = new Date(ps); d <= pe; d.setDate(d.getDate() + 1)) {
        if (cache[d.toISOString().split("T")[0]] === undefined) {
          fetchAndMerge(ps, pe).catch(() => {})
          return
        }
      }
    }
    if (offset > 0) prefetch(offset - 1)
    prefetch(offset + 1)
  }, [accessToken, offset, rangeDays, cache, fetchAndMerge])

  const total = chartData.reduce((s, d) => s + d.steps, 0)
  const avg = chartData.length ? Math.round(total / chartData.length) : 0
  const best = chartData.reduce((m, d) => d.steps > m.steps ? d : m, { date: "", steps: 0 })
  const goalsHit = chartData.filter(d => d.steps >= GOAL).length

  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const dateRange = `${fmtDate(startDate)} – ${fmtDate(endDate)}`

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  const card = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
  const T = isDark ? "text-zinc-100" : "text-zinc-900"
  const M = isDark ? "text-zinc-500" : "text-zinc-500"
  const pill = isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
  const pillOn = "bg-emerald-500/20 text-emerald-400"
  const arrow = `p-1.5 rounded-lg transition-colors ${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 disabled:opacity-25" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-500 disabled:opacity-25"}`

  const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const v = payload[0].value as number
    return (
      <div className={`px-3 py-2 rounded-xl text-sm shadow-2xl ${isDark ? "bg-zinc-800 border border-zinc-700" : "bg-white border border-zinc-200"}`}>
        <p className={`text-xs mb-1 ${M}`}>{new Date(label + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
        <p className={`font-semibold ${T}`}>{v.toLocaleString()} steps</p>
        {v >= GOAL && <p className="text-xs text-emerald-400 mt-0.5">✓ goal</p>}
      </div>
    )
  }

  if (loading && !isWindowCached) {
    return (
      <div className={`p-6 rounded-2xl border ${card} min-h-[400px] flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className={`text-xs ${M}`}>Loading steps…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 rounded-2xl border ${card} min-h-[400px] flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-red-400 text-sm font-medium mb-1">Google Fit error</p>
          <p className={`text-xs ${M} max-w-xs mb-4`}>{error}</p>
          <button onClick={retry} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors mx-auto">
            <RefreshCw size={12} /> retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-4 rounded-2xl border ${card} transition-colors duration-200`}>
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className={`text-sm font-semibold ${T}`}>Google Fit Steps</span>
          {loading && <span className="w-3 h-3 rounded-full border border-emerald-500 border-t-transparent animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          {(["7d", "30d", "90d"] as const).map(r => (
            <button
              key={r}
              onClick={() => { setRange(r); setOffset(0) }}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${range === r ? pillOn : pill}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="fitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 11 }}
              axisLine={false} tickLine={false}
              interval={range === "7d" ? 0 : range === "30d" ? 4 : 12}
              tickFormatter={v => {
                const d = new Date(v + "T12:00:00")
                return range === "7d"
                  ? d.toLocaleDateString("en-US", { weekday: "short" })
                  : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }}
            />
            <YAxis
              tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v}
            />
            <ReferenceLine y={GOAL} stroke={isDark ? "#34d39930" : "#34d39940"} strokeDasharray="4 4" />
            <Tooltip content={<Tip />} cursor={{ stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", strokeWidth: 1 }} />
            <Area dataKey="steps" stroke={ACCENT} strokeWidth={2} fill="url(#fitGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className={`flex justify-around mt-4 pt-3 border-t ${isDark ? "border-zinc-800/60" : "border-zinc-100"}`}>
        {[
          { val: fmt(total), label: "total" },
          { val: fmt(avg), label: "avg / day" },
          { val: fmt(best.steps), label: "best day" },
          { val: goalsHit, label: "goals hit" },
        ].map(({ val, label }) => (
          <div key={label} className="text-center">
            <p className="text-2xl font-bold tabular-nums text-emerald-400">{val}</p>
            <p className={`text-xs mt-0.5 ${M}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between mt-4">
        <span className={`text-xs ${M}`}>{dateRange}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset(o => o + 1)} className={arrow}>
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} className={arrow}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
