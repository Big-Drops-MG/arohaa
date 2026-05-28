import "server-only"
import { createElement } from "react"
import {
  LandingPageConnectedEmail,
  LandingPageConnectionFailedEmail,
} from "@/emails/templates"
import { sendEmail } from "@/lib/server/email/send-email"

type SendLandingConnectedEmailInput = {
  to: string
  recipientFirstName?: string
  brandName: string
  landingPageUrl: string
  dashboardUrl: string
}

type SendLandingNotDetectedEmailInput = SendLandingConnectedEmailInput

export async function sendLandingConnectedEmail(
  input: SendLandingConnectedEmailInput
): Promise<{ messageId?: string }> {
  return sendEmail({
    to: input.to,
    subject: `SDK connected for ${input.brandName}`,
    react: createElement(LandingPageConnectedEmail, {
      recipientFirstName: input.recipientFirstName,
      brandName: input.brandName,
      landingPageUrl: input.landingPageUrl,
      dashboardUrl: input.dashboardUrl,
    }),
  })
}

export async function sendLandingConnectionFailedEmail(
  input: SendLandingNotDetectedEmailInput
): Promise<{ messageId?: string }> {
  return sendEmail({
    to: input.to,
    subject: `SDK not detected for ${input.brandName}`,
    react: createElement(LandingPageConnectionFailedEmail, {
      recipientFirstName: input.recipientFirstName,
      brandName: input.brandName,
      landingPageUrl: input.landingPageUrl,
      dashboardUrl: input.dashboardUrl,
    }),
  })
}
