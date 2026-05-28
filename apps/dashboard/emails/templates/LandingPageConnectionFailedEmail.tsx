import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type LandingPageConnectionFailedEmailProps = {
  recipientFirstName?: string
  brandName: string
  landingPageUrl: string
  dashboardUrl: string
}

export function LandingPageConnectionFailedEmail({
  recipientFirstName,
  brandName,
  landingPageUrl,
  dashboardUrl,
}: LandingPageConnectionFailedEmailProps) {
  const greeting = recipientFirstName?.trim()
    ? `Hi ${recipientFirstName.trim()},`
    : "Hi,"

  return (
    <Html>
      <Head />
      <Preview>SDK connection failed for {brandName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SDK Not Detected</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            We could not detect SDK connection for <strong>{brandName}</strong>.
          </Text>
          <Section style={box}>
            <Text style={boxTitle}>Landing Page URL</Text>
            <Text style={boxValue}>{landingPageUrl}</Text>
            <Text style={listTitle}>Quick checks:</Text>
            <Text style={listItem}>
              1. Add script inside the page &lt;head&gt;
            </Text>
            <Text style={listItem}>
              2. Ensure URL is correct and page is live
            </Text>
            <Text style={listItem}>
              3. Open the landing page after adding SDK
            </Text>
          </Section>
          <Button href={dashboardUrl} style={button}>
            Check Again in Dashboard
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

export const landingPageConnectionFailedPreviewProps: LandingPageConnectionFailedEmailProps =
  {
    recipientFirstName: "Ishan",
    brandName: "Big Drops MG",
    landingPageUrl: "https://example.com/landing",
    dashboardUrl: "https://dashboard.arohaa.com/dashboard/new-landing",
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
  margin: "0 0 10px",
}

const box = {
  backgroundColor: "#fff7ed",
  border: "1px solid #fdba74",
  borderRadius: "10px",
  margin: "16px 0",
  padding: "12px 14px",
}

const boxTitle = {
  color: "#9a3412",
  fontSize: "12px",
  margin: "0 0 2px",
}

const boxValue = {
  color: "#7c2d12",
  fontSize: "14px",
  margin: "0 0 10px",
}

const listTitle = {
  color: "#7c2d12",
  fontSize: "13px",
  margin: "0 0 4px",
}

const listItem = {
  color: "#7c2d12",
  fontSize: "13px",
  margin: "0 0 3px",
}

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  marginTop: "8px",
  padding: "10px 16px",
  textDecoration: "none",
}
