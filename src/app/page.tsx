"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import GitHubWidget from "@/components/GitHubWidget"
import GoogleFitWidget from "@/components/GoogleFitWidget"
import GmailWidget from "@/components/GmailWidget"
import SpotifyWidget from "@/components/SpotifyWidget"
import { Github, Activity, Music, LogOut, Moon, Sun, GitFork, X } from "lucide-react"

export default function Home() {
  const { data: session } = useSession()
  const [tokens, setTokens] = useState<{ github?: string; google?: string; spotify?: string }>({})
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [forkDismissed, setForkDismissed] = useState(false)


  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("dashboard_tokens")
    if (stored) { try { setTokens(JSON.parse(stored)) } catch {} }
    const theme = localStorage.getItem("dashboard_theme")
    if (theme === "light") setIsDark(false)
  }, [])

  useEffect(() => {
    localStorage.setItem("dashboard_tokens", JSON.stringify(tokens))
  }, [tokens])

  useEffect(() => {
    if (mounted) localStorage.setItem("dashboard_theme", isDark ? "dark" : "light")
  }, [isDark, mounted])

  useEffect(() => {
    if (session?.accessToken && session.provider) {
      const key = session.provider === "github" ? "github" : session.provider === "spotify" ? "spotify" : "google"
      setTokens(prev => ({ ...prev, [key]: session.accessToken }))
    }
  }, [session])

  const handleSignIn = (p: "github" | "google" | "spotify") =>
    signIn(p, { callbackUrl: window.location.href })

  const handleSignOut = () => {
    localStorage.removeItem("dashboard_tokens")
    setTokens({})
    signOut()
  }

  const clearToken = (provider: "github" | "google" | "spotify") =>
    setTokens(prev => { const n = { ...prev }; delete n[provider]; return n })

  if (!mounted) return null

  const isMainDeployment = window.location.hostname === "datadbpersonal.vercel.app"
  const showForkBanner = isMainDeployment && !forkDismissed

  const bg = isDark ? "bg-[#080810]" : "bg-zinc-50"
  const T = isDark ? "text-zinc-100" : "text-zinc-900"
  const M = isDark ? "text-zinc-500" : "text-zinc-500"
  const card = isDark ? "bg-zinc-900/60 border-zinc-800/60" : "bg-white border-zinc-200"
  const nav = isDark ? "border-zinc-800/50 bg-[#080810]/80" : "border-zinc-200 bg-white/80"
  const btn = isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"
  const anyDemo = !tokens.github || !tokens.google || !tokens.spotify

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-300`}>

      {/* ── Navbar ── */}
      <header className={`sticky top-0 z-20 border-b backdrop-blur-xl ${nav}`}>
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between gap-4">

          <span className={`text-sm font-semibold tracking-tight ${T}`}>dashboard</span>

          <div className="flex items-center gap-1 ml-auto">
            {tokens.github && (
              <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                <Github size={9} /> GitHub
              </span>
            )}
            {tokens.google && (
              <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                <Activity size={9} /> Google
              </span>
            )}
            {tokens.spotify && (
              <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[#1db954]/10 text-[#1db954] border border-[#1db954]/15">
                <Music size={9} /> Spotify
              </span>
            )}
            <button onClick={() => setIsDark(d => !d)} className={`p-1.5 rounded-lg transition-colors ${btn}`}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            {session?.user && (
              <button onClick={handleSignOut} className={`p-1.5 rounded-lg transition-colors ${btn}`}>
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Fork banner — only on the main demo deployment */}
      {showForkBanner && (
        <div className="border-b border-indigo-500/20 bg-indigo-500/5">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-wrap items-center gap-3">
            <GitFork size={13} className="text-indigo-400 shrink-0" />
            <span className="text-xs text-indigo-300 flex-1 min-w-0">
              This is a shared demo — you can&apos;t connect your own accounts here.
              Fork the repo and deploy your own copy to use it with real data.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="https://github.com/lucifer-prashant/data-dashboard"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                <GitFork size={11} /> Fork on GitHub
              </a>
              <button
                onClick={() => setForkDismissed(true)}
                className="p-1 rounded-lg text-indigo-400/60 hover:text-indigo-300 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-3 space-y-3">

        {/* Demo banner + connect buttons */}
        {anyDemo && (
          <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border ${card}`}>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border border-zinc-600/40 bg-zinc-700/30 text-zinc-400 font-medium shrink-0`}>
              demo
            </span>
            <span className={`text-xs ${M} flex-1 min-w-0`}>Sample data shown — connect accounts to see your real stats</span>
            <div className="flex items-center gap-2 flex-wrap">
              {!tokens.github && (
                <button onClick={() => handleSignIn("github")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                  <Github size={12} /> GitHub
                </button>
              )}
              {!tokens.google && (
                <button onClick={() => handleSignIn("google")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                  <Activity size={12} /> Google
                </button>
              )}
              {!tokens.spotify && (
                <button onClick={() => handleSignIn("spotify")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white hover:opacity-90 transition-colors" style={{ backgroundColor: "#1db954" }}>
                  <Music size={12} /> Spotify
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 2-col layout: left stack | right stack ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Left: GitHub → Fit */}
          <div className="flex flex-col gap-3">
            <GitHubWidget accessToken={tokens.github ?? ""} isDark={isDark} demo={!tokens.github} />
            <GoogleFitWidget accessToken={tokens.google ?? ""} isDark={isDark} demo={!tokens.google} onAuthError={() => clearToken("google")} />
          </div>

          {/* Right: Spotify → Gmail */}
          <div className="flex flex-col gap-3">
            <SpotifyWidget accessToken={tokens.spotify ?? ""} isDark={isDark} demo={!tokens.spotify} />
            <GmailWidget accessToken={tokens.google ?? ""} isDark={isDark} demo={!tokens.google} onAuthError={() => clearToken("google")} />
          </div>
        </div>

        {/* YouTube slim bar */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${card}`}>
          <span className={`text-xs ${M}`}>YouTube — watch time API unavailable, manual script planned</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-400/60">soon</span>
        </div>

        <p className={`text-center text-[10px] pb-2 ${M} opacity-30`}>personal data dashboard</p>
      </main>
    </div>
  )
}

