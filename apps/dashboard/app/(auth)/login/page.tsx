import { auth } from "@/auth"
import { LoginPage } from "@/features/auth/view/LoginPage"
import { pageMetadata } from "@/lib/site-metadata"
import { redirect } from "next/navigation"
import { Suspense } from "react"

export const metadata = pageMetadata("Sign In")

export default async function AuthPage(props: {
  searchParams: Promise<{ requiresTwoFactor?: string }>
}) {
  const session = await auth()
  const searchParams = await props.searchParams

  if (session?.user && searchParams?.requiresTwoFactor !== "true") {
    redirect("/dashboard")
  }
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPage />
    </Suspense>
  )
}
