import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { eq } from "drizzle-orm"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { accounts, db, sessions, users } from "@workspace/database"
import { authConfig } from "./auth.config"

const database = db as any

const nextAuth = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(database, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false

        const existingUser = await database.query.users.findFirst({
          where: eq(users.email, user.email),
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
export const auth: (...args: any[]) => Promise<any> = nextAuth.auth
export const signIn: (...args: any[]) => Promise<any> = nextAuth.signIn
export const signOut: (...args: any[]) => Promise<any> = nextAuth.signOut
