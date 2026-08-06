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
  password: string
  loginUrl: string
}

export function ExternalMemberInviteEmail({
  recipientFirstName,
  recipientLastName,
  email,
  password,
  loginUrl,
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
      <Preview>Your Arohaa partner account details</Preview>
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

          <Heading style={heading}>Your Arohaa account</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            An Arohaa administrator created a partner account for you. Your
            sign-in details are below — keep this email private.
          </Text>
          <Section style={credBox}>
            {fullName ? (
              <>
                <Text style={credLabel}>Name</Text>
                <Text style={credValue}>{fullName}</Text>
              </>
            ) : null}
            <Text style={credLabel}>Email</Text>
            <Text style={credValue}>{email}</Text>
            <Text style={credLabel}>Password</Text>
            <Text style={credValueLast}>{password}</Text>
          </Section>
          <Text style={text}>
            Sign in with your email and password. On first login you will scan a
            QR code with Google Authenticator, 1Password, or a similar app, then
            enter the 6-digit code to finish setup.
          </Text>
          <Section style={buttonRow}>
            <Button href={loginUrl} style={button}>
              Sign in to Arohaa
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Change your password after your first sign-in. Contact your Arohaa
            administrator if you need help or a new invite.
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
    password: "ExamplePass-9xK2!",
    loginUrl: "https://dashboard.arohaa.com/login",
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

const credBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  padding: "16px",
  margin: "16px 0",
}

const credLabel = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
}

const credValue = {
  color: "#0f172a",
  fontSize: "14px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  margin: "0 0 12px",
  wordBreak: "break-all" as const,
}

const credValueLast = {
  ...credValue,
  margin: "0",
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
