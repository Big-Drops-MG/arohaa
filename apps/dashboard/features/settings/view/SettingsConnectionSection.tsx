"use client"

import { useCallback, useState } from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type {
  LandingPageRecord,
  LandingPageSettingsData,
} from "@/features/settings/model/landing-page-settings"
import { SettingsCopyBlock } from "@/features/settings/view/SettingsCopyBlock"
import { SettingsReadOnlyRow } from "@/features/settings/view/SettingsReadOnlyRow"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

type SettingsConnectionSectionProps = {
  landingPage: LandingPageRecord
  sdkSnippetHtml: string
  htmlVerificationMetaTag: string | null
  ingestApiBase: string | null
  sdkScriptUrl: string
  onConnectionUpdate: (next: LandingPageSettingsData) => void
}

type ConnectionCheckState = "idle" | "checking" | "connected" | "failed"

export function SettingsConnectionSection({
  landingPage,
  sdkSnippetHtml,
  htmlVerificationMetaTag,
  ingestApiBase,
  sdkScriptUrl,
  onConnectionUpdate,
}: SettingsConnectionSectionProps) {
  const [connectionState, setConnectionState] =
    useState<ConnectionCheckState>("idle")
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null
  )
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)
  const [isVerifyingHtml, setIsVerifyingHtml] = useState(false)

  const refreshLandingPage = useCallback(async () => {
    const res = await fetch(
      `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}`,
      { cache: "no-store" }
    )
    const data = (await res.json().catch(() => ({}))) as {
      landingPage?: LandingPageRecord
    }
    if (!res.ok || !data.landingPage) return null
    return data.landingPage
  }, [landingPage.publicId])

  const handleCheckConnection = useCallback(async () => {
    setConnectionState("checking")
    setConnectionMessage(null)

    const res = await fetch(
      `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}/check-connection`,
      { method: "POST" }
    )
    const data = (await res.json().catch(() => ({}))) as {
      connected?: boolean
      error?: string
    }

    const updated = await refreshLandingPage()
    if (updated) {
      onConnectionUpdate({
        landingPage: updated,
        sdkSnippetHtml,
        htmlVerificationMetaTag,
        ingestApiBase,
        sdkScriptUrl,
      })
    }

    if (!res.ok) {
      setConnectionState("failed")
      setConnectionMessage(data.error ?? "Connection check failed")
      return
    }

    if (data.connected) {
      setConnectionState("connected")
      setConnectionMessage("SDK or HTML verification is active for this page.")
      return
    }

    setConnectionState("failed")
    setConnectionMessage(
      "SDK not detected yet. Confirm the snippet is installed in the page head and the live URL matches this project."
    )
  }, [
    htmlVerificationMetaTag,
    ingestApiBase,
    landingPage.publicId,
    onConnectionUpdate,
    refreshLandingPage,
    sdkScriptUrl,
    sdkSnippetHtml,
  ])

  const handleVerifyHtml = useCallback(async () => {
    setIsVerifyingHtml(true)
    setVerifyMessage(null)

    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}/verify-html`,
        { method: "POST" }
      )
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        ok?: boolean
      }

      const updated = await refreshLandingPage()
      if (updated) {
        onConnectionUpdate({
          landingPage: updated,
          sdkSnippetHtml,
          htmlVerificationMetaTag,
          ingestApiBase,
          sdkScriptUrl,
        })
      }

      if (!res.ok) {
        setVerifyMessage(data.error ?? "HTML verification failed")
        return
      }

      setVerifyMessage(
        data.ok === true
          ? "HTML verification succeeded."
          : "HTML verification completed."
      )
      setConnectionState("connected")
    } finally {
      setIsVerifyingHtml(false)
    }
  }, [
    htmlVerificationMetaTag,
    ingestApiBase,
    landingPage.publicId,
    onConnectionUpdate,
    refreshLandingPage,
    sdkScriptUrl,
    sdkSnippetHtml,
  ])

  return (
    <SettingsSectionCard
      title="SDK & verification"
      description="Install the tracking snippet, optionally verify ownership with a meta tag, and confirm the connection."
    >
      <div className="space-y-6">
        <dl className="space-y-4">
          <SettingsReadOnlyRow
            label="Ingest API base"
            value={ingestApiBase ?? "Not configured"}
          />
          <SettingsReadOnlyRow label="SDK script URL" value={sdkScriptUrl} />
        </dl>

        <SettingsCopyBlock
          label="SDK snippet"
          description='Paste this script inside the landing page head tag. Optional: add data-variant="A" or data-variant="B" on the script tag for A/B experiments.'
          value={sdkSnippetHtml}
          copyLabel="Copy SDK"
        />

        {!sdkSnippetHtml.trim() ? (
          <p className="text-sm text-destructive" role="alert">
            SDK snippet is unavailable. Configure
            NEXT_PUBLIC_AROHAA_INGEST_API_BASE or INGEST_BASE_URL on the server.
          </p>
        ) : null}

        {htmlVerificationMetaTag ? (
          <SettingsCopyBlock
            label="HTML verification meta tag"
            description="Optional alternative to waiting for the first SDK event."
            value={htmlVerificationMetaTag}
            copyLabel="Copy meta tag"
          />
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCheckConnection()}
            disabled={connectionState === "checking"}
          >
            {connectionState === "checking" ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Checking
              </>
            ) : (
              "Check connection"
            )}
          </Button>
          {htmlVerificationMetaTag ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleVerifyHtml()}
              disabled={isVerifyingHtml}
            >
              {isVerifyingHtml ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Verifying
                </>
              ) : (
                "Verify HTML meta tag"
              )}
            </Button>
          ) : null}
        </div>

        {connectionState === "connected" ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm">
            <CheckCircle2
              className="size-4 shrink-0 text-green-600"
              aria-hidden
            />
            <span>{connectionMessage ?? "Connected"}</span>
          </div>
        ) : null}

        {connectionState === "failed" ? (
          <div className="flex items-start gap-2 rounded-lg border border-border px-4 py-3 text-sm">
            <XCircle
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <span>{connectionMessage ?? "Not connected"}</span>
          </div>
        ) : null}

        {verifyMessage ? (
          <p className="text-sm text-muted-foreground" role="status">
            {verifyMessage}
          </p>
        ) : null}
      </div>
    </SettingsSectionCard>
  )
}
