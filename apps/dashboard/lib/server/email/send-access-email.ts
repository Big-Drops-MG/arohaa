import "server-only"
import { createElement } from "react"
import { AccessRequestDecisionEmail } from "@/emails/templates"
import { resolveAppBaseUrl } from "@/lib/server/app-base-url"
import { sendEmail } from "@/lib/server/email/send-email"

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
