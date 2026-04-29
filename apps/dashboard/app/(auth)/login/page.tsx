import { auth } from "@/auth"
import { LoginPage } from "@/features/view/auth/LoginPage"
import { redirect } from "next/navigation"

export default async function AuthPage() {
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }
  return <LoginPage />
}
