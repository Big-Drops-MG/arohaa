import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    twoFactorAt?: number | null
    jti?: string
    user: DefaultSession["user"] & {
      id?: string
      isTwoFactorEnabled?: boolean
    }
  }

  interface User {
    isTwoFactorEnabled?: boolean
    twoFactorAt?: number | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isTwoFactorEnabled?: boolean
    twoFactorAt?: number | null
    jti?: string
    sessionExpiresAt?: number
  }
}
