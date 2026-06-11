import { GoogleAuthenticatorScreen } from "@/features/auth/view/GoogleAuthenticatorScreen"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Two-Factor Authentication")

export default function GoogleAuthenticatorScreenPage() {
  return <GoogleAuthenticatorScreen />
}
