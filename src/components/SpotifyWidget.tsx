"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { getNowPlaying, getTopTracks, getTopArtists, getRecentlyPlayed } from "@/lib/spotify"
import type { NowPlaying, TopTrack, TopArtist, PlayRecord, TimeRange } from "@/lib/spotify"
import { mergePlays, getPlaysByDateRange, getTotalCount } from "@/lib/playsDb"
import { cacheGet, cacheSet } from "@/lib/spotifyCache"
import { getDemoSpotifyData } from "@/lib/demoData"
import { RefreshCw, Music2, Clock } from "lucide-react"

interface Props {
  accessToken: string
  isDark: boolean
  onNowPlaying?: (np: NowPlaying | null) => void
  demo?: boolean
}

const ACCENT = "#1db954"
const TIME_LABELS: Record<TimeRange, string> = {
  short_term: "4 weeks",
  medium_term: "6 months",
  long_term: "all time",
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function SpotifyWidget({ accessToken, isDark, onNowPlaying, demo = false }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("short_term")
  const [view, setView] = useState<"tracks" | "artists" | "recent" | "stats">("tracks")
  const [topTracks, setTopTracks] = useState<TopTrack[]>([])
  const [topArtists, setTopArtists] = useState<TopArtist[]>([])
  const [recentTracks, setRecentTracks] = useState<PlayRecord[]>([])
  const [listenStats, setListenStats] = useState<{
    todayMs: number; weekMs: number
    chartData: { date: string; hours: number }[]
    totalDays: number; totalCount: number
  }>({ todayMs: 0, weekMs: 0, chartData: [], totalDays: 0, totalCount: 0 })
  const [nowPlaying, setNowPlayingState] = useState<NowPlaying | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Demo data initialization
  const demoData = useMemo(() => {
    if (!demo) return null
    return getDemoSpotifyData()
  }, [demo])

  useEffect(() => {
    if (demo && demoData) {
      setTopTracks(demoData.topTracks)
      setTopArtists(demoData.topArtists)
      setRecentTracks(demoData.recent)
      setNowPlayingState(demoData.nowPlaying)
      setListenStats(demoData.stats)
      setLoading(false)
      setError(null)
      prevTrackRef.current = demoData.nowPlaying?.trackName ?? null
    }
  }, [demo, demoData])
  const prevTrackRef = useRef<string | null>(null)

  const refreshStats = useCallback(async () => {
    const today = new Date()
    const todayKey = today.toISOString().split("T")[0]
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6)
    const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 29)

    const [todayPlays, weekPlays, monthPlays, count] = await Promise.all([
      getPlaysByDateRange(todayKey, todayKey),
      getPlaysByDateRange(weekAgo.toISOString().split("T")[0], todayKey),
      getPlaysByDateRange(monthAgo.toISOString().split("T")[0], todayKey),
      getTotalCount(),
    ])

    const byDate: Record<string, number> = {}
    for (const p of monthPlays) byDate[p.date] = (byDate[p.date] || 0) + p.durationMs

    const chartData: { date: string; hours: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const key = d.toISOString().split("T")[0]
      chartData.push({ date: key, hours: parseFloat(((byDate[key] || 0) / 3600000).toFixed(2)) })
    }

    setListenStats({
      todayMs: todayPlays.reduce((s, p) => s + p.durationMs, 0),
      weekMs: weekPlays.reduce((s, p) => s + p.durationMs, 0),
      chartData,
      totalDays: Object.keys(byDate).length,
      totalCount: count,
    })
  }, [])

  const mergeAndRefresh = useCallback(async (incoming: PlayRecord[]) => {
    await mergePlays(incoming)
    await refreshStats()
  }, [refreshStats])

  const TTL_TOP = 60 * 60 * 1000
  const TTL_RECENT = 5 * 60 * 1000

  const fetchAll = useCallback(async (range: TimeRange, force = false) => {
    const cachedTracks = cacheGet<TopTrack[]>(`tracks_${range}`, TTL_TOP)
    const cachedArtists = cacheGet<TopArtist[]>(`artists_${range}`, TTL_TOP)
    const cachedRecent = cacheGet<PlayRecord[]>("recent", TTL_RECENT)

    if (cachedTracks) setTopTracks(cachedTracks)
    if (cachedArtists) setTopArtists(cachedArtists)
    if (cachedRecent) setRecentTracks(cachedRecent)

    const needsTracks = force || !cachedTracks
    const needsArtists = force || !cachedArtists
    const needsRecent = force || !cachedRecent

    if (!needsTracks && !needsArtists && !needsRecent) {
      setLoading(false)
      const np = await getNowPlaying(accessToken).catch(() => null)
      setNowPlayingState(np)
      onNowPlaying?.(np)
      prevTrackRef.current = np?.trackName ?? null
      return
    }

    if (!cachedTracks && !cachedArtists && !cachedRecent) setLoading(true)
    setError(null)

    try {
      const [np, tracks, artists, recent] = await Promise.all([
        getNowPlaying(accessToken),
        needsTracks ? getTopTracks(accessToken, range) : Promise.resolve(cachedTracks!),
        needsArtists ? getTopArtists(accessToken, range) : Promise.resolve(cachedArtists!),
        needsRecent ? getRecentlyPlayed(accessToken, 50) : Promise.resolve(cachedRecent!),
      ])
      setNowPlayingState(np)
      onNowPlaying?.(np)
      setTopTracks(tracks)
      setTopArtists(artists)
      setRecentTracks(recent.slice(0, 10))
      if (needsTracks) cacheSet(`tracks_${range}`, tracks)
      if (needsArtists) cacheSet(`artists_${range}`, artists)
      if (needsRecent) cacheSet("recent", recent.slice(0, 10))
      await mergeAndRefresh(recent)
      prevTrackRef.current = np?.trackName ?? null
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || "Spotify error")
    } finally {
      setLoading(false)
    }
  }, [accessToken, mergeAndRefresh, onNowPlaying])

useEffect(() => {
    if (!demo) {
      fetchAll(timeRange)
    }
  }, [timeRange, fetchAll, demo])
  useEffect(() => { if (!demo) refreshStats() }, [refreshStats, demo])

  useEffect(() => {
    if (demo) return
    const id = setInterval(async () => {
      try {
        const [np, recent] = await Promise.all([
          getNowPlaying(accessToken),
          getRecentlyPlayed(accessToken, 50),
        ])
        setNowPlayingState(np)
        onNowPlaying?.(np)
        const fresh = recent.slice(0, 10)
        setRecentTracks(fresh)
        cacheSet("recent", fresh)
        await mergeAndRefresh(recent)
        prevTrackRef.current = np?.trackName ?? null
      } catch {}
    }, 30000)
    return () => clearInterval(id)
  }, [accessToken, mergeAndRefresh, onNowPlaying, demo])

  // ── Styles ──
  const card = isDark ? "bg-zinc-900/60 border-zinc-800/60" : "bg-white border-zinc-200"
  const T = isDark ? "text-zinc-100" : "text-zinc-900"
  const M = isDark ? "text-zinc-500" : "text-zinc-500"
  const D = isDark ? "text-zinc-400" : "text-zinc-600"
  const row = isDark ? "hover:bg-white/[0.03]" : "hover:bg-zinc-50"
  const divider = isDark ? "border-zinc-800/60" : "border-zinc-100"
  const pill = isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
  const pillOn = "text-[#1db954]"
  const pillOnBg = isDark ? "bg-[#1db954]/10 text-[#1db954]" : "bg-[#1db954]/10 text-[#1db954]"
  const viewBtn = (v: typeof view) => view === v
    ? isDark ? "text-zinc-200 border-b border-zinc-400 pb-0.5" : "text-zinc-800 border-b border-zinc-600 pb-0.5"
    : `${M} hover:text-zinc-300`

  const fmtHrs = (ms: number) => `${(ms / 3600000).toFixed(1)}h`

  const StatsTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className={`px-2.5 py-1.5 rounded-lg text-xs shadow-xl ${isDark ? "bg-zinc-800 border border-zinc-700" : "bg-white border border-zinc-200"}`}>
        <p className={`text-[10px] mb-0.5 ${M}`}>{new Date(label + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
        <p className={`font-semibold ${T}`}>{payload[0].value}h</p>
      </div>
    )
  }

  if (loading) return (
    <div className={`p-6 rounded-2xl border ${card} flex items-center justify-center py-20`}>
      <div className="text-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#1db954] border-t-transparent animate-spin mx-auto mb-3" />
        <p className={`text-xs ${M}`}>Loading Spotify…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className={`p-6 rounded-2xl border ${card} flex items-center justify-center py-20`}>
      <div className="text-center">
        <p className="text-red-400 text-sm font-medium mb-1">Spotify error</p>
        <p className={`text-xs ${M} max-w-xs mb-4`}>{error}</p>
        <button onClick={() => fetchAll(timeRange, true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#1db954]/20 text-[#1db954] hover:bg-[#1db954]/30 transition-colors mx-auto">
          <RefreshCw size={11} /> retry
        </button>
      </div>
    </div>
  )

  return (
    <div className={`rounded-2xl border ${card} overflow-hidden`}>
      {/* Header — now-playing sits inline between title and time buttons */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-0">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT }} />
        <span className={`text-sm font-semibold shrink-0 ${T}`}>Spotify</span>

        {/* Now playing — fills middle space, no layout shift */}
        {nowPlaying?.isPlaying && (
          <div className={`flex items-center gap-2 flex-1 min-w-0 mx-2 px-2.5 py-1 rounded-lg ${isDark ? "bg-zinc-800/60" : "bg-zinc-100"}`}>
            {nowPlaying.albumArt
              ? <img src={nowPlaying.albumArt} alt="" className="w-5 h-5 rounded shrink-0 object-cover" />
              : <Music2 size={10} className={M} />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-medium truncate leading-tight ${T}`}>{nowPlaying.trackName}</p>
              <p className={`text-[9px] truncate leading-tight ${M}`}>{nowPlaying.artistName}</p>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-[#1db954] animate-pulse shrink-0" />
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {(Object.keys(TIME_LABELS) as TimeRange[]).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${timeRange === r ? pillOnBg : pill}`}>
              {r === "short_term" ? "4w" : r === "medium_term" ? "6m" : "all"}
            </button>
          ))}
        </div>
      </div>

      {/* View switcher */}
      <div className={`flex gap-4 px-4 mt-2 border-b ${divider}`}>
        {(["tracks", "artists", "recent", "stats"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`text-xs pb-2.5 transition-colors capitalize ${viewBtn(v)}`}>
            {v === "tracks" ? "Top Tracks" : v === "artists" ? "Top Artists" : v === "recent" ? "Recent" : "Stats"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-2 py-1 max-h-[260px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}>

        {view === "tracks" && (
          <div>
            {topTracks.length === 0
              ? <p className={`text-xs text-center py-10 ${M}`}>No data for this period</p>
              : topTracks.map(track => (
                <a key={track.rank} href={track.trackUrl} target="_blank" rel="noreferrer"
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-xl transition-colors ${row}`}>
                  <span className={`w-4 text-xs tabular-nums shrink-0 text-right ${track.rank <= 3 ? "text-[#1db954] font-semibold" : M}`}>
                    {track.rank}
                  </span>
                  {track.albumArt
                    ? <img src={track.albumArt} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
                    : <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><Music2 size={14} className={M} /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${T}`}>{track.name}</p>
                    <p className={`text-xs truncate ${M}`}>{track.artist}</p>
                  </div>
                  <span className={`text-xs tabular-nums shrink-0 ${M}`}>{fmtDuration(track.durationMs)}</span>
                </a>
              ))
            }
          </div>
        )}

        {view === "artists" && (
          <div>
            {topArtists.length === 0
              ? <p className={`text-xs text-center py-10 ${M}`}>No data for this period</p>
              : topArtists.map(artist => (
                <a key={artist.rank} href={artist.artistUrl} target="_blank" rel="noreferrer"
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-xl transition-colors ${row}`}>
                  <span className={`w-4 text-xs tabular-nums shrink-0 text-right ${artist.rank === 1 ? "text-[#1db954] font-semibold" : M}`}>
                    {artist.rank}
                  </span>
                  {artist.imageUrl
                    ? <img src={artist.imageUrl} alt={artist.name} className="w-8 h-8 rounded-full shrink-0 object-cover" />
                    : <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><Music2 size={14} className={M} /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${T}`}>{artist.name}</p>
                    <div className="flex gap-1 mt-0.5">
                      {artist.genres.map(g => (
                        <span key={g} className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}>{g}</span>
                      ))}
                    </div>
                  </div>
                </a>
              ))
            }
          </div>
        )}

        {view === "recent" && (
          <div>
            {recentTracks.length === 0
              ? <p className={`text-xs text-center py-10 ${M}`}>No recent tracks</p>
              : recentTracks.map((track, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-1.5 rounded-xl ${row}`}>
                  {track.albumArt
                    ? <img src={track.albumArt} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
                    : <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><Music2 size={14} className={M} /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${T}`}>{track.trackName}</p>
                    <p className={`text-xs truncate ${M}`}>{track.artistName}</p>
                  </div>
                  <span className={`text-[10px] shrink-0 flex items-center gap-1 ${M}`}>
                    <Clock size={9} /> {timeAgo(track.playedAt)}
                  </span>
                </div>
              ))
            }
          </div>
        )}

        {view === "stats" && (
          <div className="px-3 py-3">
            <div className="flex gap-8 mb-5">
              {[
                { val: fmtHrs(listenStats.todayMs), label: "today" },
                { val: fmtHrs(listenStats.weekMs), label: "this week" },
                { val: listenStats.totalCount, label: "plays stored" },
              ].map(({ val, label }) => (
                <div key={label}>
                  <p className="text-3xl font-bold tabular-nums text-[#1db954]">{val}</p>
                  <p className={`text-xs mt-0.5 ${M}`}>{label}</p>
                </div>
              ))}
            </div>
            {listenStats.totalDays === 0
              ? <div className={`h-32 flex items-center justify-center rounded-xl ${isDark ? "bg-zinc-800/40" : "bg-zinc-50"}`}>
                  <p className={`text-xs ${M}`}>Keep listening — data builds up over time</p>
                </div>
              : <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={listenStats.chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="28%">
                      <defs>
                        <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={ACCENT} stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 10 }}
                        axisLine={false} tickLine={false} interval={6}
                        tickFormatter={v => new Date(v + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <YAxis tick={{ fill: isDark ? "#52525b" : "#a1a1aa", fontSize: 10 }}
                        axisLine={false} tickLine={false} tickFormatter={v => `${v}h`} />
                      <Tooltip content={<StatsTip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }} />
                      <Bar dataKey="hours" fill="url(#spGrad)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            }
          </div>
        )}
      </div>

      {/* Footer */}
      <p className={`text-[10px] px-4 pt-2 pb-3 ${M}`}>{TIME_LABELS[timeRange]}</p>
    </div>
  )
}
