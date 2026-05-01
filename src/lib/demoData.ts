import type { NowPlaying, TopTrack, TopArtist, PlayRecord, TimeRange } from "@/lib/spotify"

// ── Helpers ──
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: T[]) => arr[rand(0, arr.length - 1)]

const today = () => new Date().toISOString().split("T")[0]

// ── GitHub Demo Data ──
export function getDemoCommits(startDate: Date, endDate: Date) {
  const result: { date: string; commits: number }[] = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    // More commits on weekdays, less on weekends
    const base = dayOfWeek === 0 || dayOfWeek === 6 ? rand(0, 3) : rand(2, 12)
    // Occasionally a spike
    const spike = Math.random() < 0.05 ? rand(10, 25) : 0
    result.push({ date: d.toISOString().split("T")[0], commits: Math.max(0, base + spike) })
  }
  return result
}

// ── Spotify Demo Data ──
const demoNowPlaying: NowPlaying = {
  isPlaying: Math.random() > 0.5,
  trackName: "Midnight Dreams",
  artistName: "Luna Echo",
  albumName: "Neon Horizons",
  albumArt: null,
  progressMs: rand(45_000, 180_000),
  durationMs: rand(180_000, 300_000),
  trackUrl: "#"
}

const demoTracks: TopTrack[] = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  name: ["Blinding Lights", "Levitating", "As It Was", "Heat Waves", "Stay", "Bad Habit", "Shivers", "Watermelon Sugar", "Peaches", "Good 4 U"][i] || `Track ${i + 1}`,
  artist: ["The Weeknd", "Dua Lipa", "Harry Styles", "Glass Animals", "The Kid LAROI", "Steve Lacy", "Ed Sheeran", "Harry Styles", "Justin Bieber", "Olivia Rodrigo"][i] || "Artist",
  albumArt: null,
  durationMs: rand(150_000, 300_000),
  trackUrl: "#"
}))

const demoArtists: TopArtist[] = Array.from({ length: 5 }, (_, i) => ({
  rank: i + 1,
  name: ["Taylor Swift", "Drake", "Bad Bunny", "The Weeknd", "BTS"][i] || `Artist ${i + 1}`,
  genres: [["pop", "dance-pop"], ["hip-hop", "rap"], ["reggaeton", "latin"], ["r&b", "pop"], ["k-pop", "pop"]][i] || ["pop"],
  imageUrl: null,
  artistUrl: "#"
}))

const demoRecent: PlayRecord[] = Array.from({ length: 10 }, (_, i) => ({
  playedAt: new Date(Date.now() - rand(5 * 60_000, 48 * 60 * 60_000)).toISOString(),
  durationMs: rand(150_000, 300_000),
  trackName: demoTracks[rand(0, demoTracks.length - 1)].name,
  artistName: demoTracks[rand(0, demoTracks.length - 1)].artist,
  albumArt: null
}))

export function getDemoSpotifyData() {
  return {
    nowPlaying: demoNowPlaying,
    topTracks: demoTracks,
    topArtists: demoArtists,
    recent: demoRecent,
    stats: {
      todayMs: rand(30 * 60_000, 2 * 60 * 60_000),
      weekMs: rand(5 * 60 * 60_000, 20 * 60 * 60_000),
      chartData: Array.from({ length: 30 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        return { date: d.toISOString().split("T")[0], hours: parseFloat((Math.random() * 4 + 0.5).toFixed(2)) }
      }),
      totalDays: rand(100, 300),
      totalCount: rand(2000, 8000)
    }
  }
}

// ── Google Fit Demo Data ──
export function getDemoGoogleFit(startDate: Date, endDate: Date) {
  const result: { date: string; steps: number }[] = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Simulate walking pattern: lower on weekends, higher on weekdays, occasional rest day
    const dayOfWeek = d.getDay()
    let base = dayOfWeek === 0 || dayOfWeek === 6 ? rand(3000, 8000) : rand(6000, 15000)
    if (Math.random() < 0.1) base = 0 // rest day
    result.push({ date: d.toISOString().split("T")[0], steps: base })
  }
  return result
}

// ── Gmail Demo Data ──
export function getDemoGmail(startDate: Date, endDate: Date) {
  const daily: { date: string; count: number }[] = []
  const hourly: Record<number, number> = {}

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Workday pattern: higher on weekdays
    const dayOfWeek = d.getDay()
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5
    const count = isWorkday ? rand(30, 120) : rand(10, 50)
    daily.push({ date: d.toISOString().split("T")[0], count })
  }

  // Hourly: 8am-6pm peak, low at night
  for (let h = 0; h < 24; h++) {
    if (h >= 8 && h <= 18) hourly[h] = rand(10, 30)
    else if (h >= 6 && h < 8) hourly[h] = rand(2, 8)
    else if (h > 18 && h <= 22) hourly[h] = rand(5, 15)
    else hourly[h] = rand(0, 3)
  }

  return {
    daily,
    hourly: Object.entries(hourly).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour)
  }
}
