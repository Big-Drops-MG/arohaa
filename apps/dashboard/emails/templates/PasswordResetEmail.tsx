import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type PasswordResetEmailProps = {
  resetLink: string
  expiresInMinutes?: number
}

export function PasswordResetEmail({
  resetLink,
  expiresInMinutes = 60,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Dashboard Password</Preview>
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

          <Heading style={heading}>Reset your password</Heading>
          <Text style={text}>
            We received a request to reset your password. Click the button below
            to choose a new one.
          </Text>

          <Section style={buttonRow}>
            <Button href={resetLink} style={button}>
              Reset Password
            </Button>
          </Section>

          <Text style={expiry}>
            This link expires in {expiresInMinutes} minutes. If you did not
            request a password reset, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const passwordResetEmailPreviewProps: PasswordResetEmailProps = {
  resetLink: "https://dashboard.arohaa.net/reset-password?token=abc123",
  expiresInMinutes: 60,
}

const main = {
  backgroundColor: "#f6f8fb",
  fontFamily: "Inter, Arial, sans-serif",
  padding: "24px 0",
}

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e4e8ef",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "24px",
}

const logoRow = {
  textAlign: "center" as const,
  marginBottom: "16px",
}

const logo = {
  height: "auto",
  maxWidth: "100%",
  display: "block",
  margin: "0 auto",
}

const heading = {
  color: "#101828",
  fontSize: "24px",
  fontWeight: "700",
  lineHeight: "32px",
  textAlign: "center" as const,
  margin: "0 0 12px",
}

const text = {
  color: "#344054",
  fontSize: "14px",
  lineHeight: "22px",
  textAlign: "center" as const,
  margin: "0 0 16px",
}

const buttonRow = {
  textAlign: "center" as const,
  margin: "20px 0",
}

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "block",
  fontSize: "14px",
  fontWeight: "600",
  textAlign: "center" as const,
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px 20px",
  textDecoration: "none",
}

const expiry = {
  color: "#667085",
  fontSize: "13px",
  lineHeight: "20px",
  textAlign: "center" as const,
  margin: "0 0 16px",
}

const hr = {
  borderColor: "#e4e8ef",
  margin: "16px 0 12px",
}

const footer = {
  color: "#667085",
  fontSize: "12px",
  lineHeight: "18px",
  textAlign: "center" as const,
  margin: "0 0 4px",
}

const footerLink = {
  color: "#344054",
  display: "block",
  fontSize: "12px",
  textAlign: "center" as const,
  wordBreak: "break-all" as const,
}
