import axios from 'axios'

const BASE = 'https://api.spotify.com/v1'

function headers(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export interface NowPlaying {
  isPlaying: boolean
  trackName: string
  artistName: string
  albumName: string
  albumArt: string | null
  progressMs: number
  durationMs: number
  trackUrl: string
}

export interface TopTrack {
  rank: number
  name: string
  artist: string
  albumArt: string | null
  durationMs: number
  trackUrl: string
}

export interface TopArtist {
  rank: number
  name: string
  genres: string[]
  imageUrl: string | null
  artistUrl: string
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term'

export async function getNowPlaying(token: string): Promise<NowPlaying | null> {
  try {
    const res = await axios.get(`${BASE}/me/player/currently-playing`, { headers: headers(token) })
    if (res.status === 204 || !res.data?.item) return null
    const item = res.data.item
    return {
      isPlaying: res.data.is_playing,
      trackName: item.name,
      artistName: item.artists.map((a: any) => a.name).join(', '),
      albumName: item.album.name,
      albumArt: item.album.images?.[1]?.url ?? item.album.images?.[0]?.url ?? null,
      progressMs: res.data.progress_ms ?? 0,
      durationMs: item.duration_ms,
      trackUrl: item.external_urls.spotify,
    }
  } catch {
    return null
  }
}

export async function getTopTracks(token: string, timeRange: TimeRange): Promise<TopTrack[]> {
  const res = await axios.get(`${BASE}/me/top/tracks`, {
    headers: headers(token),
    params: { time_range: timeRange, limit: 10 },
  })
  return res.data.items.map((item: any, i: number) => ({
    rank: i + 1,
    name: item.name,
    artist: item.artists.map((a: any) => a.name).join(', '),
    albumArt: item.album.images?.[2]?.url ?? item.album.images?.[0]?.url ?? null,
    durationMs: item.duration_ms,
    trackUrl: item.external_urls.spotify,
  }))
}

export async function getTopArtists(token: string, timeRange: TimeRange): Promise<TopArtist[]> {
  const res = await axios.get(`${BASE}/me/top/artists`, {
    headers: headers(token),
    params: { time_range: timeRange, limit: 5 },
  })
  return res.data.items.map((item: any, i: number) => ({
    rank: i + 1,
    name: item.name,
    genres: item.genres.slice(0, 2),
    imageUrl: item.images?.[2]?.url ?? item.images?.[1]?.url ?? null,
    artistUrl: item.external_urls.spotify,
  }))
}

export interface PlayRecord {
  playedAt: string
  durationMs: number
  trackName: string
  artistName: string
  albumArt: string | null
}

export async function getRecentlyPlayed(token: string, limit = 10): Promise<PlayRecord[]> {
  const res = await axios.get(`${BASE}/me/player/recently-played`, {
    headers: headers(token),
    params: { limit },
  })
  return res.data.items.map((item: any) => ({
    playedAt: item.played_at,
    durationMs: item.track.duration_ms,
    trackName: item.track.name,
    artistName: item.track.artists.map((a: any) => a.name).join(', '),
    albumArt: item.track.album.images?.[2]?.url ?? null,
  }))
}
