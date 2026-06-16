"use client"

import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  LandingPageRecord,
  LandingPageSettingsData,
} from "@/features/settings/model/landing-page-settings"
import { formatLandingPageStatus } from "@/features/settings/utils/settings-format"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

type SettingsLiveSectionProps = {
  landingPage: LandingPageRecord
  onUpdated: (next: LandingPageSettingsData) => void
  settings: LandingPageSettingsData
}

export function SettingsLiveSection({
  landingPage,
  onUpdated,
  settings,
}: SettingsLiveSectionProps) {
  const [isLive, setIsLive] = useState(landingPage.isLive)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = useCallback(async () => {
    const nextLive = !isLive
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isLive: nextLive }),
        }
      )

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        landingPage?: LandingPageRecord
      }

      if (!res.ok || !data.landingPage) {
        setError(data.error ?? "Could not update live status")
        return
      }

      setIsLive(data.landingPage.isLive)
      onUpdated({
        ...settings,
        landingPage: data.landingPage,
      })
      setSuccess(
        data.landingPage.isLive
          ? "Project is live. Analytics events will be collected."
          : "Project is not live. Analytics collection is paused."
      )
    } finally {
      setIsSaving(false)
    }
  }, [isLive, landingPage.publicId, onUpdated, settings])

  return (
    <SettingsSectionCard
      title="Publishing"
      description="Control whether this project accepts analytics events from the SDK."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {isLive ? "Live" : "Not live"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isLive
                ? "Events from the installed SDK are ingested and appear in your dashboard."
                : "Event ingestion is paused. The SDK snippet can remain installed but events are rejected."}
            </p>
            <p className="text-xs text-muted-foreground">
              Current status:{" "}
              <span className="font-medium text-foreground">
                {formatLandingPageStatus(settings.landingPage.status)}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isSaving ? (
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              role="switch"
              aria-checked={isLive}
              aria-label={
                isLive ? "Mark project as not live" : "Mark project as live"
              }
              disabled={isSaving}
              onClick={() => void handleToggle()}
              className={cn(
                "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                isLive ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
                  isLive ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
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
      </div>
    </SettingsSectionCard>
  )
}
