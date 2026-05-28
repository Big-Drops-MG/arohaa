import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type LandingPageConnectedEmailProps = {
  recipientFirstName?: string
  brandName: string
  landingPageUrl: string
  dashboardUrl: string
}

export function LandingPageConnectedEmail({
  recipientFirstName,
  brandName,
  landingPageUrl,
  dashboardUrl,
}: LandingPageConnectedEmailProps) {
  const greeting = recipientFirstName?.trim()
    ? `Hi ${recipientFirstName.trim()},`
    : "Hi,"

  return (
    <Html>
      <Head />
      <Preview>SDK connected for {brandName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Landing Page Connected</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Your landing page for <strong>{brandName}</strong> is now connected
            successfully.
          </Text>
          <Section style={card}>
            <Text style={metaLabel}>Brand</Text>
            <Text style={metaValue}>{brandName}</Text>
            <Text style={metaLabel}>Landing Page URL</Text>
            <Text style={metaValue}>{landingPageUrl}</Text>
          </Section>
          <Section style={buttonRow}>
            <Button href={dashboardUrl} style={button}>
              Open Dashboard
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If this was not expected, review your landing page settings in the{" "}
            <Link href={dashboardUrl} style={footerLink}>
              dashboard
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const landingPageConnectedPreviewProps: LandingPageConnectedEmailProps =
  {
    recipientFirstName: "Ishan",
    brandName: "Big Drops MG",
    landingPageUrl: "https://example.com/landing",
    dashboardUrl: "https://dashboard.arohaa.com/dashboard",
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

const heading = {
  color: "#101828",
  fontSize: "24px",
  fontWeight: "700",
  lineHeight: "32px",
  margin: "0 0 12px",
}

const text = {
  color: "#344054",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 12px",
}

const card = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px 14px",
  margin: "16px 0",
}

const metaLabel = {
  color: "#667085",
  fontSize: "12px",
  margin: "0 0 2px",
}

const metaValue = {
  color: "#101828",
  fontSize: "14px",
  margin: "0 0 10px",
}

const buttonRow = {
  margin: "18px 0 8px",
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

const hr = {
  borderColor: "#e4e8ef",
  margin: "20px 0 12px",
}

const footer = {
  color: "#667085",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
}

const footerLink = {
  color: "#101828",
  textDecoration: "underline",
}
