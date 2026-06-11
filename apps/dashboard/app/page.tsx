import { pageMetadata } from "@/lib/site-metadata"
import { redirect } from "next/navigation"

export const metadata = pageMetadata("Sign In")

export default async function Page() {
  redirect("/login")
}
