"use client"

import { useCallback, useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { changeProfilePassword } from "@/actions/profile.actions"
import type { ProfileData } from "@/features/profile/model/profile"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

type ProfileSecuritySectionProps = {
  profile: ProfileData
}

export function ProfileSecuritySection({
  profile,
}: ProfileSecuritySectionProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length >= 8 &&
    newPassword === confirmPassword

  const handleSubmit = useCallback(async () => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const result = await changeProfilePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccess("Password updated.")
    } finally {
      setIsSaving(false)
    }
  }, [confirmPassword, currentPassword, newPassword])

  if (!profile.hasPassword) {
    return (
      <SettingsSectionCard
        title="Security"
        description="Password management for your account."
      >
        <p className="text-sm text-muted-foreground">
          You signed in with an external provider. Password changes are managed
          through that provider.
        </p>
      </SettingsSectionCard>
    )
  }

  return (
    <SettingsSectionCard
      title="Security"
      description="Update your password. You will stay signed in on this device."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-current-password">Current password</Label>
          <div className="relative">
            <Input
              id="profile-current-password"
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 pr-10"
            />
            <button
              type="button"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? "Hide password" : "Show password"}
            >
              {showCurrent ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-new-password">New password</Label>
            <div className="relative">
              <Input
                id="profile-new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 pr-10"
              />
              <button
                type="button"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-confirm-password">
              Confirm new password
            </Label>
            <div className="relative">
              <Input
                id="profile-confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 pr-10"
              />
              <button
                type="button"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters.
        </p>

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
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Updating
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </div>
    </SettingsSectionCard>
  )
}
