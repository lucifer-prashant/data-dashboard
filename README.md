# Personal Data Dashboard

A self-hosted dashboard that visualises your GitHub commits, Google Fit steps, Spotify listening history, and Gmail activity — all in one place.

**Live demo:** https://datadbpersonal.vercel.app  
*(Shows sample data. Fork and deploy your own copy to connect real accounts.)*

---

## What it shows

| Widget | Data |
|--------|------|
| **GitHub** | Commit heatmap (12 / 26 weeks), total commits, active days, best day |
| **Google Fit** | Daily step chart (7 / 30 / 90 days), avg, best day, goals hit |
| **Spotify** | Now playing, top tracks / artists, recently played, listen-time stats |
| **Gmail** | Daily + hourly email volume charts, peak hour, totals |

Without credentials every widget shows realistic sample data automatically.

---

## Deploy your own copy

### 1 — Fork the repo

Click **Fork** on this repo to get your own copy on GitHub.

### 2 — Create OAuth apps

You only need the services you actually want to connect.

<details>
<summary><strong>GitHub</strong></summary>

1. Go to https://github.com/settings/developers → **New OAuth App**
2. Set **Homepage URL** to your Vercel URL (you can update this after deploy)
3. Set **Callback URL** to `https://YOUR-APP.vercel.app/api/auth/callback/github`
4. Copy **Client ID** and generate a **Client Secret**

</details>

<details>
<summary><strong>Google (Fit + Gmail)</strong></summary>

1. Go to https://console.cloud.google.com → create a project
2. Enable **Fitness API** and **Gmail API**
3. Create **OAuth 2.0 credentials** (Web application)
4. Add `https://YOUR-APP.vercel.app/api/auth/callback/google` as an authorised redirect URI
5. Copy **Client ID** and **Client Secret**

</details>

<details>
<summary><strong>Spotify</strong></summary>

1. Go to https://developer.spotify.com/dashboard → **Create App**
2. Add `https://YOUR-APP.vercel.app/api/auth/callback/spotify` as a redirect URI
3. Copy **Client ID** and **Client Secret**

</details>

### 3 — Deploy to Vercel

1. Go to https://vercel.com → **New Project** → import your fork
2. Before deploying, open **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` and paste the output |
| `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` |
| `GITHUB_ID` | *(optional)* |
| `GITHUB_SECRET` | *(optional)* |
| `GOOGLE_CLIENT_ID` | *(optional)* |
| `GOOGLE_CLIENT_SECRET` | *(optional)* |
| `SPOTIFY_CLIENT_ID` | *(optional)* |
| `SPOTIFY_CLIENT_SECRET` | *(optional)* |

3. Click **Deploy**

### 4 — Connect accounts

Open your deployment, click the connect buttons in the banner, sign in, and your real data will appear.

---

## Run locally

```bash
git clone https://github.com/YOUR_USERNAME/data-dashboard
cd data-dashboard
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

Open http://localhost:3000.

---

## Tech stack

- **Next.js 15** (App Router, Turbopack)
- **NextAuth v4** — OAuth for GitHub, Google, Spotify
- **Tailwind CSS** — styling
- **Recharts** — charts
- **IndexedDB** via `idb` — local Spotify play history cache

---

## Notes

- All data stays in your browser / your own Vercel deployment. Nothing is sent to any third-party server.
- Google Fit API is read-only (`fitness.activity.read`).
- Gmail API is read-only (`gmail.readonly`) — only message counts are fetched, not content.
- YouTube widget is planned but the watch-time API requires a manual data export script.
