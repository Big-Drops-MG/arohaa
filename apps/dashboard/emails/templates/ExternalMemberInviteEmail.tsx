import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type ExternalMemberInviteEmailProps = {
  recipientFirstName?: string
  recipientLastName?: string
  email: string
  acceptLink: string
  expiresInHours: number
}

export function ExternalMemberInviteEmail({
  recipientFirstName,
  recipientLastName,
  email,
  acceptLink,
  expiresInHours,
}: ExternalMemberInviteEmailProps) {
  const fullName = [recipientFirstName?.trim(), recipientLastName?.trim()]
    .filter(Boolean)
    .join(" ")
  const greeting = recipientFirstName?.trim()
    ? `Hi ${recipientFirstName.trim()},`
    : "Hi,"

  return (
    <Html>
      <Head />
      <Preview>Accept your Arohaa partner invite</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoRow}>
            <Img
              src="https://www.arohaa.net/auth-logo.svg"
              width="140"
              alt="Arohaa Logo"
              style={logo}
            />
          </Section>

          <Hr style={hr} />

          <Heading style={heading}>You're invited to Arohaa</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            An Arohaa administrator created a partner account for{" "}
            {fullName || email}. Use the secure link below to set your password.
            This link expires in {expiresInHours} hours and works once.
          </Text>
          <Section style={buttonRow}>
            <Button href={acceptLink} style={button}>
              Accept invite
            </Button>
          </Section>
          <Text style={text}>
            After setting your password, sign in with {email}. On first login
            you will scan a QR code with Google Authenticator, 1Password, or a
            similar app, then enter the 6-digit code to finish setup.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you did not expect this invite, you can ignore this email.
            Contact your Arohaa administrator if you need a new link.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const externalMemberInvitePreviewProps: ExternalMemberInviteEmailProps =
  {
    recipientFirstName: "Alex",
    recipientLastName: "Partner",
    email: "alex@partner.com",
    acceptLink: "https://dashboard.arohaa.com/accept-invite?token=example",
    expiresInHours: 48,
  }

const main = {
  backgroundColor: "#f6f8fb",
  fontFamily: "Inter, Arial, sans-serif",
  padding: "24px 0",
}

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  margin: "0 auto",
  padding: "32px 28px",
  maxWidth: "520px",
  border: "1px solid #e6ebf2",
}

const logoRow = {
  textAlign: "center" as const,
  marginBottom: "8px",
}

const logo = {
  height: "auto",
  maxWidth: "100%",
  display: "block",
  margin: "0 auto",
}

const heading = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 16px",
}

const text = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 12px",
}

const buttonRow = {
  margin: "24px 0 8px",
}

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 18px",
  textDecoration: "none",
}

const hr = {
  borderColor: "#e6ebf2",
  margin: "24px 0 16px",
}

const footer = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
}
