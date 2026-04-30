"use client"

import { useEffect, useMemo, useCallback, useState } from "react"
import { getAuthoredCommits } from "@/lib/github"
import { usePersistedCache } from "@/lib/usePersistedCache"
import { RefreshCw } from "lucide-react"

interface Props {
  accessToken: string
  isDark: boolean
}

const ACCENT = [129, 140, 248] // indigo-400 rgb

function cellColor(commits: number, isDark: boolean): string {
  if (commits < 0) return "transparent"
  if (commits === 0) return isDark ? "rgba(129,140,248,0.07)" : "rgba(129,140,248,0.10)"
  if (commits <= 2)  return "rgba(129,140,248,0.28)"
  if (commits <= 5)  return "rgba(129,140,248,0.52)"
  if (commits <= 9)  return "rgba(129,140,248,0.76)"
  return `rgb(${ACCENT.join(",")})`
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEK_OPTIONS = [12, 26] as const
type WeekRange = typeof WEEK_OPTIONS[number]

type Cell = { date: string; commits: number; future: boolean }

export default function GitHubWidget({ accessToken, isDark }: Props) {
  const [weekRange, setWeekRange] = useState<WeekRange>(26)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = usePersistedCache<Record<string, number>>("gh_commits")
  const [tooltip, setTooltip] = useState<{ date: string; commits: number; x: number; y: number } | null>(null)

  const { startDate, endDate } = useMemo(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999)
    // start = Sunday of the week (weekRange) weeks ago
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const thisSunday = new Date(today); thisSunday.setDate(today.getDate() - today.getDay())
    const start = new Date(thisSunday); start.setDate(thisSunday.getDate() - (weekRange - 1) * 7)
    start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate: end }
  }, [weekRange])

  const isWindowCached = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    if (cache[today] === undefined) return false
    // spot-check a few dates in range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
      if (cache[d.toISOString().split("T")[0]] === undefined) return false
    }
    return true
  }, [cache, startDate, endDate])

  const fetchRange = useCallback(async () => {
    try {
      const result = await getAuthoredCommits(accessToken, startDate, endDate)
      setCache(prev => {
        const next = { ...prev }
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const k = d.toISOString().split("T")[0]
          if (next[k] === undefined) next[k] = 0
        }
        result.forEach(item => { next[item.date] = item.commits })
        return next
      })
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Unknown error")
    }
  }, [accessToken, startDate, endDate])

  useEffect(() => {
    if (isWindowCached) return
    setLoading(true)
    fetchRange().finally(() => setLoading(false))
  }, [fetchRange, isWindowCached])

  // Build grid: weeks as columns, days (Sun–Sat) as rows
  const { grid, monthLabels } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayKey = today.toISOString().split("T")[0]
    const thisSunday = new Date(today); thisSunday.setDate(today.getDate() - today.getDay())

    const weeks: Cell[][] = []
    const months: { col: number; label: string }[] = []
    let lastMonth = -1

    for (let w = weekRange - 1; w >= 0; w--) {
      const weekStart = new Date(thisSunday)
      weekStart.setDate(thisSunday.getDate() - w * 7)
      const week: Cell[] = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart); day.setDate(weekStart.getDate() + d)
        const key = day.toISOString().split("T")[0]
        const future = day > today
        week.push({ date: key, commits: future ? -1 : (cache[key] ?? -1), future })
        if (d === 0 && day.getMonth() !== lastMonth) {
          lastMonth = day.getMonth()
          months.push({ col: weekRange - 1 - w, label: day.toLocaleDateString("en-US", { month: "short" }) })
        }
      }
      weeks.push(week)
    }
    return { grid: weeks, monthLabels: months }
  }, [cache, weekRange])

  const allCells = grid.flat().filter(c => !c.future && c.date)
  const total = allCells.reduce((s, c) => s + Math.max(0, c.commits), 0)
  const activeDays = allCells.filter(c => c.commits > 0).length
  const best = allCells.reduce((m, c) => c.commits > m.commits ? c : m, { date: "", commits: 0 })

  const card = isDark ? "bg-zinc-900/60 border-zinc-800/60" : "bg-white border-zinc-200"
  const T = isDark ? "text-zinc-100" : "text-zinc-900"
  const M = isDark ? "text-zinc-500" : "text-zinc-500"
  const stat = isDark ? "bg-zinc-800/70" : "bg-zinc-50"
  const pill = isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
  const pillOn = "bg-indigo-500/20 text-indigo-400"

  if (loading && !isWindowCached) {
    return (
      <div className={`p-6 rounded-2xl border ${card} min-h-[360px] flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className={`text-xs ${M}`}>Loading commits…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 rounded-2xl border ${card} min-h-[360px] flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-red-400 text-sm font-medium mb-1">GitHub error</p>
          <p className={`text-xs ${M} max-w-xs mb-4`}>{error}</p>
          <button
            onClick={() => { setError(null); setCache(prev => { const n = {...prev}; for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate()+1)) delete n[d.toISOString().split("T")[0]]; return n }) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors mx-auto"
          >
            <RefreshCw size={12} /> retry
          </button>
        </div>
      </div>
    )
  }

  const CELL = 13 // cell size + gap

  return (
    <div className={`p-4 rounded-2xl border ${card} transition-colors duration-200`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          <span className={`text-sm font-semibold ${T}`}>GitHub Commits</span>
          {loading && <span className="w-3 h-3 rounded-full border border-indigo-500 border-t-transparent animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          {WEEK_OPTIONS.map(w => (
            <button key={w} onClick={() => setWeekRange(w)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${weekRange === w ? pillOn : pill}`}>
              {w}w
            </button>
          ))}
        </div>
      </div>


      {/* Heatmap */}
      <div className="relative" onMouseLeave={() => setTooltip(null)}>
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col justify-around pt-5 pr-1 shrink-0">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`text-[10px] ${M} leading-none`}>
                {i % 2 === 1 ? d.slice(0, 1) : ""}
              </div>
            ))}
          </div>

          {/* Grid — fills all available width */}
          <div className="flex-1 min-w-0">
            {/* Month labels */}
            <div className="relative h-5 mb-1">
              {monthLabels.map(({ col, label }) => (
                <span
                  key={`${col}-${label}`}
                  className={`absolute text-[10px] ${M}`}
                  style={{ left: `${(col / weekRange) * 100}%` }}
                >
                  {label}
                </span>
              ))}
            </div>
            {/* Week columns */}
            <div className="flex gap-[3px]">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px] flex-1">
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      className="rounded-[3px] cursor-default aspect-square hover:ring-1 hover:ring-indigo-400/40 transition-all"
                      style={{ backgroundColor: cellColor(cell.commits, isDark) }}
                      onMouseEnter={e => {
                        if (!cell.date || cell.future) return
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        const parent = (e.target as HTMLElement).closest('.relative')!.getBoundingClientRect()
                        setTooltip({
                          date: cell.date,
                          commits: Math.max(0, cell.commits),
                          x: rect.left - parent.left + rect.width / 2,
                          y: rect.top - parent.top - 36,
                        })
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className={`absolute z-10 px-2.5 py-1.5 rounded-lg text-xs shadow-xl pointer-events-none -translate-x-1/2 whitespace-nowrap ${isDark ? "bg-zinc-800 border border-zinc-700" : "bg-white border border-zinc-200"}`}
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <span className={`font-semibold ${T}`}>{tooltip.commits} commit{tooltip.commits !== 1 ? "s" : ""}</span>
            <span className={`ml-1.5 ${M}`}>{new Date(tooltip.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </div>
        )}
      </div>

      {/* Stats — large, below heatmap */}
      <div className={`flex justify-around mt-4 pt-3 border-t ${isDark ? "border-zinc-800/60" : "border-zinc-100"}`}>
        {[
          { val: total, label: "total" },
          { val: activeDays, label: "active days" },
          { val: best.commits || 0, label: "best day" },
        ].map(({ val, label }) => (
          <div key={label} className="text-center">
            <p className="text-2xl font-bold tabular-nums text-indigo-400">{val}</p>
            <p className={`text-xs mt-0.5 ${M}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-4 justify-end">
        <span className={`text-[10px] ${M}`}>less</span>
        {[0.07, 0.28, 0.52, 0.76, 1].map(op => (
          <div key={op} className="w-3 h-3 rounded-[3px]"
            style={{ backgroundColor: `rgba(129,140,248,${op})` }} />
        ))}
        <span className={`text-[10px] ${M}`}>more</span>
      </div>
    </div>
  )
}
