import { auth } from "@/auth"
import { LoginPage } from "@/features/auth/view/LoginPage"
import { pageMetadata } from "@/lib/site-metadata"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Suspense } from "react"

export const metadata = pageMetadata("Sign In")

function sessionNeedsTwoFactorVerification(
  user: { isTwoFactorEnabled?: boolean } | undefined,
  hasVerified2FA: boolean
): boolean {
  return user?.isTwoFactorEnabled === true && !hasVerified2FA
}

export default async function AuthPage(props: {
  searchParams: Promise<{ requiresTwoFactor?: string }>
}) {
  const session = await auth()
  const searchParams = await props.searchParams

  if (session?.user && searchParams?.requiresTwoFactor !== "true") {
    const cookieStore = await cookies()
    const hasVerified2FA =
      cookieStore.get("arohaa_2fa_verified")?.value === "true"

    if (
      sessionNeedsTwoFactorVerification(
        session.user as { isTwoFactorEnabled?: boolean },
        hasVerified2FA
      )
    ) {
      redirect("/login?requiresTwoFactor=true")
    }

    redirect("/dashboard")
  }
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPage />
    </Suspense>
  )
}
