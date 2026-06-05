"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { LandingPageRecord } from "@/features/settings/model/landing-page-settings"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

type SettingsDangerZoneSectionProps = {
  landingPage: LandingPageRecord
}

export function SettingsDangerZoneSection({
  landingPage,
}: SettingsDangerZoneSectionProps) {
  const router = useRouter()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)

  const handleArchive = useCallback(async () => {
    if (!confirmArchive) {
      setConfirmArchive(true)
      setError(null)
      return
    }

    setIsArchiving(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Could not archive landing page")
        setConfirmArchive(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } finally {
      setIsArchiving(false)
    }
  }, [confirmArchive, landingPage.publicId, router])

  return (
    <SettingsSectionCard
      title="Danger zone"
      description="Archive this landing page to stop collecting analytics and remove it from your dashboard."
      className="border-destructive/30"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Archiving removes{" "}
          <span className="font-medium text-foreground">
            {landingPage.brandName}
          </span>{" "}
          from the dashboard. This action cannot be undone from the UI.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleArchive()}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Archiving
              </>
            ) : confirmArchive ? (
              "Confirm archive"
            ) : (
              "Archive landing page"
            )}
          </Button>
          {confirmArchive && !isArchiving ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmArchive(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </SettingsSectionCard>
  )
}
