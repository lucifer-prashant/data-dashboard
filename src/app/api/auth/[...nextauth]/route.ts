import NextAuth, { type NextAuthOptions } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Spotify from "next-auth/providers/spotify"
import type { OAuthConfig } from "next-auth/providers/oauth"

const isDemo = process.env.DEMO_MODE === 'true'

const providers: OAuthConfig<any>[] = []

if (!isDemo) {
  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: { params: { scope: "repo" } }
    }))
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          scope: "openid https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/youtube.readonly"
        }
      }
    }))
  }
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    providers.push(Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "user-read-currently-playing user-read-recently-played user-top-read"
        }
      }
    }))
  }
}

const handler = NextAuth({
  providers,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token
        token.provider = account.provider
      }
      token.demo = isDemo
      return token
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken as string | undefined;
      (session as any).provider = token.provider as string | undefined;
      (session as any).demo = token.demo as boolean
      return session
    }
  }
})

export { handler as GET, handler as POST }
