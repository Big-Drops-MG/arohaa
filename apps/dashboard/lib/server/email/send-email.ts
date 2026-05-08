import "server-only"
import type { ReactElement } from "react"
import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { render, toPlainText } from "@react-email/render"
import { resolveSesConfig } from "@/lib/server/email/config"
import { getSesClient } from "@/lib/server/email/ses-client"

type SendEmailInput = {
  to: string | string[]
  subject: string
  react: ReactElement
  replyTo?: string | string[]
}

function asList(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function formatFromAddress(fromEmail: string, fromName?: string): string {
  if (!fromName) return fromEmail
  return `${fromName} <${fromEmail}>`
}

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: SendEmailInput): Promise<{ messageId?: string }> {
  const recipients = asList(to)
  if (!recipients.length) {
    throw new Error("No recipient provided for email send")
  }

  const html = await render(react)
  const text = toPlainText(html)
  const cfg = resolveSesConfig()
  const client = getSesClient()

  const result = await client.send(
    new SendEmailCommand({
      FromEmailAddress: formatFromAddress(cfg.fromEmail, cfg.fromName),
      Destination: {
        ToAddresses: recipients,
      },
      ReplyToAddresses: asList(replyTo),
      ConfigurationSetName: cfg.configurationSetName,
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: html,
              Charset: "UTF-8",
            },
            Text: {
              Data: text,
              Charset: "UTF-8",
            },
          },
        },
      },
    })
  )

  return { messageId: result.MessageId }
}
