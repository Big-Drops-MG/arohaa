"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { updateProfile } from "@/actions/profile.actions"
import type { ProfileData } from "@/features/profile/model/profile"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

type ProfilePersonalSectionProps = {
  profile: ProfileData
}

export function ProfilePersonalSection({
  profile,
}: ProfilePersonalSectionProps) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(profile.firstName)
  const [lastName, setLastName] = useState(profile.lastName)
  const [image, setImage] = useState(profile.image ?? "")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const formData = new FormData()
      formData.set("firstName", firstName)
      formData.set("lastName", lastName)
      formData.set("image", image)

      const result = await updateProfile(formData)

      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess("Profile updated.")
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }, [firstName, image, lastName, router])

  const imagePreview = image.trim() || null

  return (
    <SettingsSectionCard
      title="Personal information"
      description="Update how your name and avatar appear across the dashboard."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-950 text-sm font-semibold text-white">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt=""
                width={56}
                height={56}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U"
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Your initials are used when no profile image URL is set.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-image-url">Profile image URL</Label>
          <Input
            id="profile-image-url"
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            autoComplete="off"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Must be a public http or https image URL.
          </p>
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
          disabled={isSaving || !firstName.trim() || !lastName.trim()}
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
