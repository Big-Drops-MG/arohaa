import "server-only"
import { createElement } from "react"
import { ExternalMemberInviteEmail } from "@/emails/templates"
import { sendEmail } from "@/lib/server/email/send-email"

function resolveAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "")
  }
  return "https://dashboard.arohaa.com"
}

type SendExternalMemberInviteEmailInput = {
  to: string
  recipientFirstName?: string
  password: string
  twoFactorSecret: string
}

export async function sendExternalMemberInviteEmail(
  input: SendExternalMemberInviteEmailInput
): Promise<{ messageId?: string } | null> {
  const base = resolveAppBaseUrl()
  try {
    return await sendEmail({
      to: input.to,
      subject: "Your Arohaa collaborator account",
      react: createElement(ExternalMemberInviteEmail, {
        recipientFirstName: input.recipientFirstName,
        email: input.to,
        password: input.password,
        twoFactorSecret: input.twoFactorSecret,
        loginUrl: `${base}/login`,
      }),
    })
  } catch (err) {
    console.error("[external-invite-email] failed to send", err)
    return null
  }
}
