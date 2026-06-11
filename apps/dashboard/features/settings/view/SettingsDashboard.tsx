"use client"

import { useCallback, useState } from "react"
import type { LandingPageSettingsData } from "@/features/settings/model/landing-page-settings"
import { SettingsConnectionSection } from "@/features/settings/view/SettingsConnectionSection"
import { SettingsDangerZoneSection } from "@/features/settings/view/SettingsDangerZoneSection"
import { SettingsGeneralSection } from "@/features/settings/view/SettingsGeneralSection"
import { SettingsProjectDetailsSection } from "@/features/settings/view/SettingsProjectDetailsSection"

type SettingsDashboardProps = {
  initialData: LandingPageSettingsData
}

export function SettingsDashboard({ initialData }: SettingsDashboardProps) {
  const [settings, setSettings] = useState(initialData)

  const handleSettingsUpdate = useCallback((next: LandingPageSettingsData) => {
    setSettings(next)
  }, [])

  return (
    <div className="flex flex-col gap-4 px-4 pb-2 sm:px-6 lg:px-8">
      <div className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage landing page details, SDK installation, verification, and
          project lifecycle.
        </p>
      </div>

      <SettingsGeneralSection
        key={settings.landingPage.updatedAt}
        landingPage={settings.landingPage}
        onSaved={handleSettingsUpdate}
      />

      <SettingsProjectDetailsSection landingPage={settings.landingPage} />

      <SettingsConnectionSection
        landingPage={settings.landingPage}
        sdkSnippetHtml={settings.sdkSnippetHtml}
        htmlVerificationMetaTag={settings.htmlVerificationMetaTag}
        ingestApiBase={settings.ingestApiBase}
        sdkScriptUrl={settings.sdkScriptUrl}
        onConnectionUpdate={handleSettingsUpdate}
      />

      <SettingsDangerZoneSection landingPage={settings.landingPage} />
    </div>
  )
}
