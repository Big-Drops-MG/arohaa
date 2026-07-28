import "server-only"
import { createElement } from "react"
import { AccessRequestDecisionEmail } from "@/emails/templates"
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

type SendAccessDecisionEmailInput = {
  to: string
  recipientFirstName?: string
  decision: "accepted" | "rejected"
}

export async function sendAccessRequestDecisionEmail(
  input: SendAccessDecisionEmailInput
): Promise<{ messageId?: string } | null> {
  const base = resolveAppBaseUrl()
  try {
    return await sendEmail({
      to: input.to,
      subject:
        input.decision === "accepted"
          ? "Arohaa access request accepted"
          : "Arohaa access request rejected",
      react: createElement(AccessRequestDecisionEmail, {
        recipientFirstName: input.recipientFirstName,
        decision: input.decision,
        dashboardUrl: `${base}/dashboard`,
        loginUrl: `${base}/login`,
      }),
    })
  } catch (err) {
    console.error("[access-email] failed to send decision email", err)
    return null
  }
}
