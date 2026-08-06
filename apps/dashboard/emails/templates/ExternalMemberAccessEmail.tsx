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

export type ExternalMemberAccessProject = {
  brandName: string
  utmSources: string[]
  tabs: string[]
}

type ExternalMemberAccessEmailProps = {
  recipientFirstName?: string
  projects: ExternalMemberAccessProject[]
  dashboardUrl: string
}

export function ExternalMemberAccessEmail({
  recipientFirstName,
  projects,
  dashboardUrl,
}: ExternalMemberAccessEmailProps) {
  const greeting = recipientFirstName?.trim()
    ? `Hi ${recipientFirstName.trim()},`
    : "Hi,"

  return (
    <Html>
      <Head />
      <Preview>Your Arohaa project access</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Project access updated</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Your Arohaa collaborator access has been updated. You can view the
            projects and traffic sources listed below.
          </Text>

          {projects.length === 0 ? (
            <Text style={text}>
              No project access is assigned yet. Your administrator will grant
              access when ready.
            </Text>
          ) : (
            projects.map((project) => (
              <Section key={project.brandName} style={projectBox}>
                <Text style={projectTitle}>{project.brandName}</Text>
                {project.utmSources.length > 0 ? (
                  <Text style={projectMeta}>
                    UTM Source: {project.utmSources.join(", ")}
                  </Text>
                ) : null}
                {project.tabs.length > 0 ? (
                  <Text style={projectMeta}>
                    Tabs: {project.tabs.join(", ")}
                  </Text>
                ) : null}
              </Section>
            ))
          )}

          <Section style={buttonRow}>
            <Button href={dashboardUrl} style={button}>
              Open dashboard
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Access is read-only. Contact your Arohaa administrator if something
            looks incorrect.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const externalMemberAccessPreviewProps: ExternalMemberAccessEmailProps =
  {
    recipientFirstName: "Alex",
    projects: [
      {
        brandName: "Acme Landing",
        utmSources: ["facebook", "google"],
        tabs: ["Overview", "Traffic", "Funnel"],
      },
    ],
    dashboardUrl: "https://dashboard.arohaa.com/dashboard",
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

const projectBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  padding: "14px 16px",
  margin: "0 0 10px",
}

const projectTitle = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: 600,
  margin: "0 0 6px",
}

const projectMeta = {
  color: "#475569",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 2px",
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
