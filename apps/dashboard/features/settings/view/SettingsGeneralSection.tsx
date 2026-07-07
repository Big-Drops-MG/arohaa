"use client"

import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type {
  LandingPageRecord,
  LandingPageSettingsData,
} from "@/features/settings/model/landing-page-settings"
import { FormTypeFieldset } from "@/features/settings/view/FormTypeFieldset"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

type SettingsGeneralSectionProps = {
  landingPage: LandingPageRecord
  onSaved: (next: LandingPageSettingsData) => void
}

export function SettingsGeneralSection({
  landingPage,
  onSaved,
}: SettingsGeneralSectionProps) {
  const [brandName, setBrandName] = useState(landingPage.brandName)
  const [landingPageUrl, setLandingPageUrl] = useState(
    landingPage.landingPageUrl
  )
  const [faviconUrl, setFaviconUrl] = useState(landingPage.faviconUrl ?? "")
  const [formType, setFormType] = useState<OverviewLandingFormType>(
    landingPage.formType
  )
  const [notes, setNotes] = useState(landingPage.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandName,
            landingPageUrl,
            formType,
            faviconUrl,
            notes,
          }),
        }
      )

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        landingPage?: LandingPageRecord
        htmlVerificationMetaTag?: string
        urlChanged?: boolean
      }

      if (!res.ok || !data.landingPage) {
        setError(data.error ?? "Could not save settings")
        return
      }

      const snippetRes = await fetch(
        `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}/snippet`,
        { cache: "no-store" }
      )
      const snippetData = (await snippetRes.json().catch(() => ({}))) as {
        sdkSnippetHtml?: string
        htmlVerificationMetaTag?: string | null
        ingestApiBase?: string | null
        sdkScriptUrl?: string
      }

      onSaved({
        landingPage: data.landingPage,
        sdkSnippetHtml:
          typeof snippetData.sdkSnippetHtml === "string"
            ? snippetData.sdkSnippetHtml
            : "",
        htmlVerificationMetaTag:
          typeof snippetData.htmlVerificationMetaTag === "string"
            ? snippetData.htmlVerificationMetaTag
            : (data.htmlVerificationMetaTag ?? null),
        ingestApiBase:
          typeof snippetData.ingestApiBase === "string"
            ? snippetData.ingestApiBase
            : null,
        sdkScriptUrl:
          typeof snippetData.sdkScriptUrl === "string"
            ? snippetData.sdkScriptUrl
            : "",
      })

      setSuccess(
        data.urlChanged
          ? "Settings saved. Landing page URL changed — reinstall the SDK snippet and verify connection again."
          : formType !== landingPage.formType
            ? "Settings saved. Form type changed — copy the updated SDK snippet below and reinstall it on your page."
            : "Settings saved."
      )
    } finally {
      setIsSaving(false)
    }
  }, [
    brandName,
    faviconUrl,
    formType,
    landingPage.formType,
    landingPage.publicId,
    landingPageUrl,
    notes,
    onSaved,
  ])

  const isValid =
    brandName.trim().length > 0 && landingPageUrl.trim().length > 0

  return (
    <SettingsSectionCard
      title="General"
      description="Update how this landing page appears in Arohaa and how analytics labels are applied."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-brand-name">Brand name</Label>
          <Input
            id="settings-brand-name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="h-11"
            autoComplete="organization"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-landing-page-url">Landing page URL</Label>
          <Input
            id="settings-landing-page-url"
            type="url"
            value={landingPageUrl}
            onChange={(e) => setLandingPageUrl(e.target.value)}
            className="h-11"
            autoComplete="url"
          />
          <p className="text-xs text-muted-foreground">
            Changing the URL resets SDK verification and rotates the HTML
            verification token.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-favicon-url">Favicon URL</Label>
          <Input
            id="settings-favicon-url"
            type="url"
            value={faviconUrl}
            onChange={(e) => setFaviconUrl(e.target.value)}
            className="h-11"
            placeholder="https://example.com/favicon.ico"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Used exactly as entered. Set the favicon for this project here; it
            is not detected or changed automatically.
          </p>
        </div>

        <FormTypeFieldset value={formType} onChange={setFormType} />

        <div className="space-y-2">
          <Label htmlFor="settings-notes">Notes</Label>
          <textarea
            id="settings-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Internal notes about this landing page"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-muted-foreground" role="status">
            {success}
          </p>
        ) : null}

        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isValid || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Saving
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </SettingsSectionCard>
  )
}
