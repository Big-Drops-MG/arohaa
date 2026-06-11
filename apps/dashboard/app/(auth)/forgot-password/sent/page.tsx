import { ForgotPasswordMessageScreen } from "@/features/auth/view/ForgotPasswordMessageScreen"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Check Your Email")

export default async function MessageScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <ForgotPasswordMessageScreen email={email} />
}
