"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { getGmailCounts } from "@/lib/gmail"
import { cacheGet, cacheSet } from "@/lib/spotifyCache"
import { getDemoGmail } from "@/lib/demoData"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

interface Props {
  accessToken: string
  isDark: boolean
  demo?: boolean
  onAuthError?: () => void
}

const ACCENT = "#fbbf24"

type GmailData = { daily: { date: string; count: number }[]; hourly: { hour: number; count: number }[] }

export default function GmailWidget({ accessToken, isDark, demo = false, onAuthError }: Props) {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<Record<string, GmailData>>(() => {
    if (typeof window === 'undefined') return {}
    return cacheGet<Record<string, GmailData>>('gmail_cache', Infinity) ?? {}
  })

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

  const cacheKey = `${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}`

  const demoData = useMemo(() => {
    if (!demo) return null
    return getDemoGmail(startDate, endDate)
  }, [demo, startDate, endDate])

  const cached = demo ? demoData : cache[cacheKey]

  const retry = useCallback(() => {
    setError(null)
    setCache(prev => {
      const next = { ...prev }
      delete next[cacheKey]
      return next
    })
  }, [cacheKey])

  useEffect(() => {
    if (demo || cached || !accessToken) return
    setLoading(true)
    setError(null)
    getGmailCounts(accessToken, startDate, endDate)
      .then(result => setCache(prev => {
        const next = { ...prev, [cacheKey]: result }
        // don't cache windows containing today — they change throughout the day
        const today = new Date().toISOString().split('T')[0]
        const toStore = Object.fromEntries(Object.entries(next).filter(([k]) => !k.includes(today)))
        cacheSet('gmail_cache', toStore)
        return next
      }))
      .catch((e: any) => {
        if (e?.response?.status === 401) { onAuthError?.(); return }
        setError(e?.response?.data?.error?.message || e?.message || "Unknown error")
      })
      .finally(() => setLoading(false))
  }, [accessToken, cacheKey, demo, onAuthError])

  const { daily: dailyData, hourly: hourlyData } = cached ?? { daily: [], hourly: [] }

  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const dateRange = `${fmtDate(startDate)} – ${fmtDate(endDate)}`

  const total = dailyData.reduce((s, d) => s + d.count, 0)
  const avg = dailyData.length ? Math.round(total / dailyData.length) : 0
  const peak = hourlyData.reduce((m, h) => h.count > m.count ? h : m, { hour: 0, count: 0 })

  const card = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
  const T = isDark ? "text-zinc-100" : "text-zinc-900"
  const M = isDark ? "text-zinc-500" : "text-zinc-500"
  const pill = isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
  const pillOn = "bg-amber-500/20 text-amber-400"
  const arrow = `p-1.5 rounded-lg transition-colors ${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 disabled:opacity-25" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-500 disabled:opacity-25"}`

  const DailyTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className={`px-3 py-2 rounded-xl text-sm shadow-2xl ${isDark ? "bg-zinc-800 border border-zinc-700" : "bg-white border border-zinc-200"}`}>
        <p className={`text-xs mb-1 ${M}`}>{new Date(label + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
        <p className={`font-semibold ${T}`}>{payload[0].value} emails</p>
      </div>
    )
  }

  const HourTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const h = label as number
    const period = h >= 12 ? "PM" : "AM"
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return (
      <div className={`px-3 py-2 rounded-xl text-sm shadow-2xl ${isDark ? "bg-zinc-800 border border-zinc-700" : "bg-white border border-zinc-200"}`}>
        <p className={`text-xs mb-1 ${M}`}>{h12}:00 {period}</p>
        <p className={`font-semibold ${T}`}>{payload[0].value} emails</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`p-6 rounded-2xl border ${card} min-h-[400px] flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-7 h-7 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className={`text-xs ${M}`}>Loading emails…</p>
          <p className={`text-xs mt-1 ${M} opacity-60`}>may take a moment</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 rounded-2xl border ${card} min-h-[400px] flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-red-400 text-sm font-medium mb-1">Gmail error</p>
          <p className={`text-xs ${M} max-w-xs mb-4`}>{error}</p>
          <button onClick={retry} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors mx-auto">
            <RefreshCw size={12} /> retry
          </button>
        </div>
      </div>
    )
  }

  const fmtHour = (h: number) => {
    const p = h >= 12 ? "PM" : "AM"
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}${p}`
  }

  return (
    <div className={`p-4 rounded-2xl border ${card} transition-colors duration-200`}>
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className={`text-sm font-semibold ${T}`}>Gmail Activity</span>
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

      {/* Charts side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={`text-xs font-medium mb-2 ${M}`}>per day</p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="30%">
                <defs>
                  <linearGradient id="gmailDailyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  interval={range === "7d" ? 0 : range === "30d" ? 6 : 20}
                  tickFormatter={v => new Date(v + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <YAxis tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DailyTip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="count" fill="url(#gmailDailyGrad)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className={`text-xs font-medium mb-2 ${M}`}>by hour</p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="18%">
                <defs>
                  <linearGradient id="gmailHourGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  interval={5}
                  tickFormatter={v => fmtHour(v)}
                />
                <YAxis tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<HourTip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="count" fill="url(#gmailHourGrad)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-4 gap-2 mt-3 pt-3 border-t ${isDark ? "border-zinc-800/60" : "border-zinc-100"}`}>
        {[
          { val: total.toLocaleString(), label: "total" },
          { val: avg.toLocaleString(), label: "avg/day" },
          { val: peak.count ? fmtHour(peak.hour) : "—", label: "peak hr" },
          { val: peak.count || 0, label: "peak ct" },
        ].map(({ val, label }) => (
          <div key={label} className="text-center">
            <p className="text-xl font-bold tabular-nums text-amber-400">{val}</p>
            <p className={`text-[10px] mt-0.5 ${M}`}>{label}</p>
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
