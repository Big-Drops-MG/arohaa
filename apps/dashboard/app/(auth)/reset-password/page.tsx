import { ResetPassword } from "@/features/auth/view/ResetPassword"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Reset Password")

export default function ResetPasswordPage() {
  return <ResetPassword />
}
