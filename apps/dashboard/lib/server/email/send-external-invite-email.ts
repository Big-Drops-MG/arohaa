import "server-only"
import { createElement } from "react"
import {
  ExternalMemberAccessEmail,
  ExternalMemberInviteEmail,
  type ExternalMemberAccessProject,
} from "@/emails/templates"
import { resolveAppBaseUrl } from "@/lib/server/app-base-url"
import { sendEmail } from "@/lib/server/email/send-email"

type SendExternalMemberInviteEmailInput = {
  to: string
  recipientFirstName?: string
  recipientLastName?: string
  inviteUrl: string
}

export async function sendExternalMemberInviteEmail(
  input: SendExternalMemberInviteEmailInput
): Promise<{ messageId?: string } | null> {
  const base = resolveAppBaseUrl()
  const acceptLink = `${base}/accept-invite?token=${encodeURIComponent(input.inviteUrl)}`

  try {
    return await sendEmail({
      to: input.to,
      subject: "You're invited to Arohaa",
      react: createElement(ExternalMemberInviteEmail, {
        recipientFirstName: input.recipientFirstName,
        recipientLastName: input.recipientLastName,
        email: input.to,
        acceptLink,
        expiresInHours: 48,
      }),
    })
  } catch (err) {
    console.error("[external-invite-email] failed to send", err)
    return null
  }
}

type SendExternalMemberAccessEmailInput = {
  to: string
  recipientFirstName?: string
  projects: ExternalMemberAccessProject[]
}

export async function sendExternalMemberAccessEmail(
  input: SendExternalMemberAccessEmailInput
): Promise<{ messageId?: string } | null> {
  const base = resolveAppBaseUrl()
  try {
    return await sendEmail({
      to: input.to,
      subject: "Your Arohaa project access",
      react: createElement(ExternalMemberAccessEmail, {
        recipientFirstName: input.recipientFirstName,
        projects: input.projects,
        dashboardUrl: `${base}/dashboard`,
      }),
    })
  } catch (err) {
    console.error("[external-access-email] failed to send", err)
    return null
  }
}
