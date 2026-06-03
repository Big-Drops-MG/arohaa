import { ForgotPassword } from "@/features/auth/view/ForgotPassword"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Forgot Password")

export default function ForgotPasswordPage() {
  return <ForgotPassword />
}
