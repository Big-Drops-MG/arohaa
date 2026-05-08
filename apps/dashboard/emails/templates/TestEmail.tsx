import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type TestEmailProps = {
  dashboardName?: string
}

export function TestEmail({ dashboardName = "Arohaa" }: TestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>AWS SES is successfully integrated</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoRow}>
            <Img
              src="https://arohaa.net/favicon.ico"
              width="28"
              height="28"
              alt="Arohaa Logo"
              style={logo}
            />
            <Text style={brandText}>{dashboardName}</Text>
          </Section>

          <Heading style={heading}>AWS SES is successfully integrated</Heading>
          <Text style={description}>
            Your email delivery pipeline is connected and ready. Transactional
            emails can now be sent through AWS SES from your application.
          </Text>

          <Section style={buttonRow}>
            <Button href="https://arohaa.net" style={button}>
              Visit Arohaa
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const testEmailPreviewProps: TestEmailProps = {
  dashboardName: "Arohaa",
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
  marginBottom: "16px",
}

const logo = {
  borderRadius: "6px",
  display: "inline-block",
  verticalAlign: "middle" as const,
}

const brandText = {
  color: "#101828",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "700",
  margin: "0 0 0 10px",
  verticalAlign: "middle" as const,
}

const heading = {
  color: "#101828",
  fontSize: "26px",
  fontWeight: "700",
  lineHeight: "34px",
  margin: "0 0 12px",
}

const description = {
  color: "#344054",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 20px",
}

const buttonRow = {
  marginTop: "8px",
}

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  padding: "10px 16px",
  textDecoration: "none",
}
