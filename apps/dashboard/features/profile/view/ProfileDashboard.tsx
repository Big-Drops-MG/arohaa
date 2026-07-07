import type { ProfileData } from "@/features/profile/model/profile"
import { ProfileAccountSection } from "@/features/profile/view/ProfileAccountSection"
import { ProfileAlertWebhooksSection } from "@/features/profile/view/ProfileAlertWebhooksSection"
import { ProfileApiKeysSection } from "@/features/profile/view/ProfileApiKeysSection"
import { ProfilePersonalSection } from "@/features/profile/view/ProfilePersonalSection"
import { ProfileSecuritySection } from "@/features/profile/view/ProfileSecuritySection"

type ProfileDashboardProps = {
  profile: ProfileData
}

export function ProfileDashboard({ profile }: ProfileDashboardProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
      <div className="pt-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal details and account security.
        </p>
      </div>

      <div className="space-y-4">
        <ProfilePersonalSection
          key={`${profile.firstName}-${profile.lastName}-${profile.image ?? ""}`}
          profile={profile}
        />
        <ProfileAccountSection profile={profile} />
        <ProfileApiKeysSection />
        <ProfileAlertWebhooksSection />
        <ProfileSecuritySection profile={profile} />
      </div>
    </div>
  )
}
