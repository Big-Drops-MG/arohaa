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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setError(null)
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(landingPage.publicId)}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Could not delete project")
        setConfirmDelete(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } finally {
      setIsDeleting(false)
    }
  }, [confirmDelete, landingPage.publicId, router])

  return (
    <SettingsSectionCard
      title="Delete project"
      description="Permanently remove this project from your dashboard and stop all analytics collection."
      className="border-destructive/30"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Deleting removes{" "}
          <span className="font-medium text-foreground">
            {landingPage.brandName}
          </span>{" "}
          from the dashboard. Analytics data already collected may remain in
          storage, but the project cannot be restored from the UI.
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
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Deleting
              </>
            ) : confirmDelete ? (
              "Confirm delete"
            ) : (
              "Delete project"
            )}
          </Button>
          {confirmDelete && !isDeleting ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmDelete(false)
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
