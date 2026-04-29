import { DrizzleAdapter } from "@auth/drizzle-adapter"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { verifySync } from "otplib"
import {
  accounts,
  db,
  normalizeUserEmail,
  sessions,
  users,
  whereUserEmail,
} from "@workspace/database"
import { authConfig } from "./auth.config"

type DrizzleAdapterDb = Parameters<typeof DrizzleAdapter>[0]

const googleProviderConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET)

const nextAuth = NextAuth({
  trustHost: true,
  ...authConfig,
  adapter: DrizzleAdapter(db as DrizzleAdapterDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "2FA Code", type: "text" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const email = normalizeUserEmail(String(credentials.email))
        const password = String(credentials.password)
        const codeRaw = credentials.code
        const code =
          typeof codeRaw === "string" && codeRaw.trim()
            ? codeRaw.trim()
            : undefined

        const existingUser = await db.query.users.findFirst({
          where: whereUserEmail(email),
        })

        if (!existingUser?.password) return null

        const passwordsMatch = await bcrypt.compare(
          password,
          existingUser.password
        )

        if (!passwordsMatch) return null

        if (existingUser.isTwoFactorEnabled) {
          if (!existingUser.twoFactorSecret) return null
          if (!code) return null
          const totp = String(code).replace(/\D/g, "").slice(0, 6)
          if (totp.length !== 6) return null
          const ok = verifySync({
            secret: existingUser.twoFactorSecret,
            token: totp,
            epochTolerance: 90,
          }).valid
          if (!ok) return null
        }

        return {
          id: existingUser.id,
          email: existingUser.email
            ? normalizeUserEmail(existingUser.email)
            : undefined,
          name: existingUser.name ?? undefined,
          image: existingUser.image ?? undefined,
        }
      },
    }),
    ...(googleProviderConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false

        const existingUser = await db.query.users.findFirst({
          where: whereUserEmail(normalizeUserEmail(user.email)),
        })

        if (!existingUser) return false
      }

      return true
    },
    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      return session
    },
  },
})

export const handlers = nextAuth.handlers
export const auth: typeof nextAuth.auth = nextAuth.auth
export const signIn: typeof nextAuth.signIn = nextAuth.signIn
export const signOut: typeof nextAuth.signOut = nextAuth.signOut
