import { ForgotPasswordMessageScreen } from "@/features/auth/view/ForgotPasswordMessageScreen"

export default async function MessageScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <ForgotPasswordMessageScreen email={email} />
}
