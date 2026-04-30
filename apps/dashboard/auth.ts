import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import type { Adapter } from "next-auth/adapters"
import { db, whereUserEmail } from "@workspace/database"
import bcrypt from "bcryptjs"
import { redis } from "./lib/redis"
import { authConfig } from "./auth.config"

const googleProviderConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET)

const nextAuth = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db as any) as Adapter,
  session: { strategy: "jwt" },

  providers: [
    ...(googleProviderConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { prompt: "select_account" } },
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Authenticator Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const userRow = await db.query.users.findFirst({
          where: whereUserEmail(email),
        })

        if (!userRow || !userRow.password) return null

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          userRow.password
        )

        if (!passwordsMatch) return null

        if (userRow.isTwoFactorEnabled && !credentials.code) {
          return null
        }

        return {
          id: userRow.id,
          email: userRow.email,
          name: userRow.name,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const allowedDomains = ["bigdropsmarketing.com"]
        const emailDomain = user.email?.split("@")[1]

        const isAllowed = allowedDomains.includes(emailDomain ?? "")

        if (!isAllowed) {
          console.warn(
            `Blocked sign-in attempt from unauthorized domain: ${emailDomain}`
          )
          return false
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await db.query.users.findFirst({
          where: whereUserEmail(user.email || ""),
        })
        token.sub = dbUser?.id || user.id
        token.isTwoFactorEnabled = dbUser?.isTwoFactorEnabled || false
      }
      return token
    },
    async session({ session, token, user }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub
        ;(session.user as any).isTwoFactorEnabled =
          token.isTwoFactorEnabled as boolean
      } else if (user && session.user) {
        session.user.id = user.id
        const dbUser = await db.query.users.findFirst({
          where: whereUserEmail(user.email || ""),
        })
        ;(session.user as any).isTwoFactorEnabled =
          dbUser?.isTwoFactorEnabled || false
      }
      return session
    },
  },
})

export const handlers = nextAuth.handlers
export const auth: typeof nextAuth.auth = nextAuth.auth
export const signIn: typeof nextAuth.signIn = nextAuth.signIn
export const signOut: typeof nextAuth.signOut = nextAuth.signOut
