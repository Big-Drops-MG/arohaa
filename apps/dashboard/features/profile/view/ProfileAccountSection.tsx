import type { ProfileData } from "@/features/profile/model/profile"
import {
  formatEmailVerified,
  formatTwoFactorStatus,
} from "@/features/profile/utils/profile-format"
import { SettingsReadOnlyRow } from "@/features/settings/view/SettingsReadOnlyRow"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

type ProfileAccountSectionProps = {
  profile: ProfileData
}

export function ProfileAccountSection({ profile }: ProfileAccountSectionProps) {
  return (
    <SettingsSectionCard
      title="Account"
      description="Sign-in details and security settings for your Arohaa account."
    >
      <dl className="space-y-4">
        <SettingsReadOnlyRow label="Email" value={profile.email || "—"} />
        <SettingsReadOnlyRow label="Role" value={profile.role || "—"} />
        <SettingsReadOnlyRow
          label="Email verified"
          value={formatEmailVerified(profile.emailVerified)}
        />
        <SettingsReadOnlyRow
          label="Two-factor authentication"
          value={formatTwoFactorStatus(profile.isTwoFactorEnabled)}
        />
        <SettingsReadOnlyRow
          label="Sign-in method"
          value={profile.hasPassword ? "Email and password" : "OAuth"}
        />
      </dl>
    </SettingsSectionCard>
  )
}
