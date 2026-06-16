import type { LandingPageRecord } from "@/features/settings/model/landing-page-settings"
import {
  formatLandingPageStatus,
  formatSettingsTimestamp,
  formatSdkInstallStatus,
  formatVerificationMethod,
} from "@/features/settings/utils/settings-format"
import { SettingsReadOnlyRow } from "@/features/settings/view/SettingsReadOnlyRow"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

type SettingsProjectDetailsSectionProps = {
  landingPage: LandingPageRecord
}

export function SettingsProjectDetailsSection({
  landingPage,
}: SettingsProjectDetailsSectionProps) {
  return (
    <SettingsSectionCard
      title="Project details"
      description="Read-only identifiers and derived URL fields used by analytics and the SDK."
    >
      <dl className="space-y-4">
        <SettingsReadOnlyRow label="Project ID" value={landingPage.publicId} />
        <SettingsReadOnlyRow label="SDK workspace ID" value={landingPage.id} />
        <SettingsReadOnlyRow
          label="Workspace ID"
          value={landingPage.workspaceId}
        />
        <SettingsReadOnlyRow label="Hostname" value={landingPage.hostname} />
        <SettingsReadOnlyRow label="Origin" value={landingPage.origin} />
        <SettingsReadOnlyRow
          label="Canonical URL"
          value={landingPage.normalizedUrl}
        />
        <SettingsReadOnlyRow
          label="Page status"
          value={formatLandingPageStatus(landingPage.status)}
        />
        <SettingsReadOnlyRow
          label="Live tracking"
          value={landingPage.isLive ? "Live" : "Not live"}
        />
        <SettingsReadOnlyRow
          label="SDK install status"
          value={formatSdkInstallStatus(landingPage.sdkInstallStatus)}
        />
        <SettingsReadOnlyRow
          label="Verification method"
          value={formatVerificationMethod(landingPage.verificationMethod)}
        />
        <SettingsReadOnlyRow
          label="Verified at"
          value={formatSettingsTimestamp(landingPage.verifiedAt)}
        />
        <SettingsReadOnlyRow
          label="Last seen"
          value={formatSettingsTimestamp(landingPage.lastSeenAt)}
        />
        <SettingsReadOnlyRow
          label="Last event"
          value={formatSettingsTimestamp(landingPage.lastEventAt)}
        />
        <SettingsReadOnlyRow
          label="Created"
          value={formatSettingsTimestamp(landingPage.createdAt)}
        />
        <SettingsReadOnlyRow
          label="Updated"
          value={formatSettingsTimestamp(landingPage.updatedAt)}
        />
      </dl>
    </SettingsSectionCard>
  )
}
