import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import type { Adapter, AdapterUser } from "next-auth/adapters"
import {
  accessRoles,
  accounts,
  db,
  sessions,
  SUPERADMIN_ROLE_KEY,
  users,
  verificationTokens,
  whereUserEmail,
  normalizeUserEmail,
} from "@workspace/database"
import bcrypt from "bcryptjs"
import { eq, sql } from "drizzle-orm"
import { authConfig } from "./auth.config"
import { getMemberRoleId } from "@/lib/server/actor-can"
import { consumeTotp, consumeTwoFactorSessionStamp } from "@/lib/server/totp"
import { readTotpSecretFromRow } from "@/lib/server/totp-secrets"
import { DUMMY_PASSWORD_HASH } from "@/lib/server/auth-timing"
import {
  SESSION_MAX_AGE_SECONDS,
  sessionExpiresAtFromNow,
  shouldInvalidateJwtSession,
} from "@/lib/server/session-token-utils"

const googleProviderConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET)

const useSecureCookies =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.AUTH_URL?.startsWith("https://"))

const SESSION_COOKIE = useSecureCookies
  ? "__Secure-authjs.session-token.v2"
  : "authjs.session-token.v2"

function getFullName(
  firstName?: string | null,
  lastName?: string | null
): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim()
}

function parseOAuthDisplayName(name: string | null | undefined): {
  firstName: string | null
  lastName: string | null
} {
  const trimmed = name?.trim()
  if (!trimmed) return { firstName: null, lastName: null }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0] ?? null, lastName: null }
  }
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  }
}

function bootstrapSuperadminEmails(): Set<string> {
  const raw = process.env.SUPERADMIN_BOOTSTRAP_EMAILS?.trim() ?? ""
  if (!raw) return new Set()
  return new Set(
    raw
      .split(",")
      .map((e) => normalizeUserEmail(e))
      .filter(Boolean)
  )
}

async function resolveBootstrapRoleId(email: string | null | undefined) {
  const memberRoleId = await getMemberRoleId()
  if (!email) return memberRoleId

  if (process.env.NODE_ENV === "production") {
    return memberRoleId
  }

  const seeds = bootstrapSuperadminEmails()
  if (!seeds.has(normalizeUserEmail(email))) return memberRoleId

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.accessStatus, "approved"))

  if ((countRow?.count ?? 0) > 0) return memberRoleId

  const superadmin = await db.query.accessRoles.findFirst({
    where: eq(accessRoles.key, SUPERADMIN_ROLE_KEY),
    columns: { id: true },
  })
  return superadmin?.id ?? memberRoleId
}

function drizzleAdapter(): Adapter {
  const base = DrizzleAdapter(
    db as never,
    {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    } as never
  ) as Adapter
  return {
    ...base,
    async createUser(data: AdapterUser) {
      const { name, ...rest } = data
      const mapped = parseOAuthDisplayName(name)
      const roleId = await resolveBootstrapRoleId(rest.email)
      return await base.createUser!({
        ...rest,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        roleId,
      } as AdapterUser)
    },
    async updateUser(data: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
      if (!data.id) {
        throw new Error("No user id.")
      }
      const { name, ...rest } = data
      if (name === undefined) {
        return await base.updateUser!(data as AdapterUser & { id: string })
      }
      const mapped = parseOAuthDisplayName(name)
      return await base.updateUser!({
        ...rest,
        id: data.id,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
      } as AdapterUser & { id: string })
    },
  }
}

const nextAuth = NextAuth({
  ...authConfig,
  adapter: drizzleAdapter(),
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },

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

        const email = String(credentials.email)
        const password = String(credentials.password)
        const codeRaw = credentials.code
        const code =
          typeof codeRaw === "string" && codeRaw.trim() ? codeRaw.trim() : ""

        const userRow = await db.query.users.findFirst({
          where: whereUserEmail(normalizeUserEmail(email)),
        })

        if (!userRow?.password) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
          return null
        }

        const passwordsMatch = await bcrypt.compare(password, userRow.password)
        if (!passwordsMatch) return null

        let twoFactorAt: number | null = null

        if (userRow.isTwoFactorEnabled) {
          if (!/^\d{6}$/.test(code)) return null
          if (!userRow.twoFactorSecret) return null
          const secret = await readTotpSecretFromRow(
            userRow.id,
            userRow,
            "twoFactorSecret"
          )
          if (!secret) return null
          const ok = await consumeTotp(userRow.id, secret, code)
          if (!ok) return null
          twoFactorAt = Date.now()
        }

        const displayName =
          getFullName(userRow.firstName, userRow.lastName) || userRow.email

        return {
          id: userRow.id,
          email: userRow.email,
          name: displayName || null,
          isTwoFactorEnabled: Boolean(userRow.isTwoFactorEnabled),
          twoFactorAt,
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
    async jwt({ token, user, account, trigger }) {
      if (!user) {
        if (
          shouldInvalidateJwtSession({
            sessionExpiresAt: token.sessionExpiresAt,
          })
        ) {
          return {}
        }

        const { isSessionTokenRevoked } =
          await import("@/lib/server/session-revocation")
        if (
          await isSessionTokenRevoked({
            jti: typeof token.jti === "string" ? token.jti : undefined,
            sub: typeof token.sub === "string" ? token.sub : undefined,
            iat: typeof token.iat === "number" ? token.iat : undefined,
          })
        ) {
          return {}
        }
      }

      if (user) {
        token.jti = crypto.randomUUID()
        token.sessionExpiresAt = sessionExpiresAtFromNow()
        const dbUser = await db.query.users.findFirst({
          where: whereUserEmail(normalizeUserEmail(user.email || "")),
        })
        token.sub = dbUser?.id || user.id
        token.isTwoFactorEnabled = Boolean(dbUser?.isTwoFactorEnabled)
        if (account?.provider === "credentials") {
          token.twoFactorAt =
            typeof user.twoFactorAt === "number" ? user.twoFactorAt : null
        } else {
          token.twoFactorAt = null
        }
        if (dbUser?.id) {
          const { touchUserLastSeen } =
            await import("@/lib/server/user-last-seen")
          void touchUserLastSeen(dbUser.id)
        }
      } else if (token.sub && token.isTwoFactorEnabled !== true) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.sub as string),
          columns: { isTwoFactorEnabled: true },
        })
        if (dbUser?.isTwoFactorEnabled) {
          token.isTwoFactorEnabled = true
          token.twoFactorAt = null
        }
      }

      if (trigger === "update" && token.sub && token.jti) {
        const stamped = await consumeTwoFactorSessionStamp(token.sub, token.jti)
        if (stamped != null) {
          token.twoFactorAt = stamped
          token.isTwoFactorEnabled = true
        }
      }

      return token
    },
    async session({ session, token, user }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub
        session.user.isTwoFactorEnabled = Boolean(token.isTwoFactorEnabled)
        session.twoFactorAt =
          typeof token.twoFactorAt === "number" ? token.twoFactorAt : null
        session.jti = typeof token.jti === "string" ? token.jti : undefined
      } else if (user && session.user) {
        session.user.id = user.id
        const dbUser = await db.query.users.findFirst({
          where: whereUserEmail(normalizeUserEmail(user.email || "")),
        })
        session.user.isTwoFactorEnabled = Boolean(dbUser?.isTwoFactorEnabled)
        session.twoFactorAt = null
      }
      return session
    },
  },
})

export const handlers = nextAuth.handlers
export const auth: typeof nextAuth.auth = nextAuth.auth
export const signIn: typeof nextAuth.signIn = nextAuth.signIn
export const signOut: typeof nextAuth.signOut = nextAuth.signOut
export const unstable_update: typeof nextAuth.unstable_update =
  nextAuth.unstable_update
