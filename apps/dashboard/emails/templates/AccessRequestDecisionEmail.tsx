import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type AccessRequestDecisionEmailProps = {
  recipientFirstName?: string
  decision: "accepted" | "rejected"
  dashboardUrl: string
  loginUrl: string
}

export function AccessRequestDecisionEmail({
  recipientFirstName,
  decision,
  dashboardUrl,
  loginUrl,
}: AccessRequestDecisionEmailProps) {
  const greeting = recipientFirstName?.trim()
    ? `Hi ${recipientFirstName.trim()},`
    : "Hi,"
  const accepted = decision === "accepted"

  return (
    <Html>
      <Head />
      <Preview>
        {accepted
          ? "Your Arohaa access request was accepted"
          : "Your Arohaa access request was rejected"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            {accepted ? "Request Accepted" : "Request Rejected"}
          </Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            {accepted
              ? "Your request to join Arohaa has been accepted. You can now sign in and use the dashboard."
              : "Your request to join Arohaa has been rejected. You will not have access to the dashboard."}
          </Text>
          {accepted ? (
            <Section style={buttonRow}>
              <Button href={dashboardUrl} style={button}>
                Open Dashboard
              </Button>
            </Section>
          ) : (
            <Section style={buttonRow}>
              <Button href={loginUrl} style={button}>
                Back to Login
              </Button>
            </Section>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            If you have questions, contact your Arohaa team administrator.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const accessRequestDecisionPreviewProps: AccessRequestDecisionEmailProps =
  {
    recipientFirstName: "Sami",
    decision: "accepted",
    dashboardUrl: "https://dashboard.arohaa.com/dashboard",
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
