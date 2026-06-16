"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { LandingPageSettingsData } from "@/features/settings/model/landing-page-settings"
import { SettingsActivityLogSection } from "@/features/settings/view/SettingsActivityLogSection"
import { SettingsConnectionSection } from "@/features/settings/view/SettingsConnectionSection"
import { SettingsDangerZoneSection } from "@/features/settings/view/SettingsDangerZoneSection"
import { SettingsGeneralSection } from "@/features/settings/view/SettingsGeneralSection"
import { SettingsLiveSection } from "@/features/settings/view/SettingsLiveSection"
import {
  SETTINGS_NAV_ITEMS,
  SettingsNav,
  type SettingsSectionId,
} from "@/features/settings/view/SettingsNav"
import { SettingsProjectDetailsSection } from "@/features/settings/view/SettingsProjectDetailsSection"

type SettingsDashboardProps = {
  initialData: LandingPageSettingsData
}

function parseSettingsSection(value: string | null): SettingsSectionId | null {
  if (!value) return null
  return SETTINGS_NAV_ITEMS.some((item) => item.id === value)
    ? (value as SettingsSectionId)
    : null
}

export function SettingsDashboard({ initialData }: SettingsDashboardProps) {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState(initialData)
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("general")

  useEffect(() => {
    const section = parseSettingsSection(searchParams.get("section"))
    if (section) {
      setActiveSection(section)
    }
  }, [searchParams])

  const handleSettingsUpdate = useCallback((next: LandingPageSettingsData) => {
    setSettings(next)
  }, [])

  return (
    <div className="flex flex-col gap-6 px-4 pb-6 sm:px-6 lg:px-8">
      <div className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Manage project details, SDK tracking, publishing status, activity
          logs, and lifecycle actions for{" "}
          <span className="font-medium text-foreground">
            {settings.landingPage.brandName}
          </span>
          .
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <SettingsNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        <div className="min-w-0 space-y-4">
          {activeSection === "general" ? (
            <SettingsGeneralSection
              key={settings.landingPage.updatedAt}
              landingPage={settings.landingPage}
              onSaved={handleSettingsUpdate}
            />
          ) : null}

          {activeSection === "publishing" ? (
            <SettingsLiveSection
              key={`live-${settings.landingPage.updatedAt}`}
              landingPage={settings.landingPage}
              settings={settings}
              onUpdated={handleSettingsUpdate}
            />
          ) : null}

          {activeSection === "tracking" ? (
            <SettingsConnectionSection
              landingPage={settings.landingPage}
              sdkSnippetHtml={settings.sdkSnippetHtml}
              htmlVerificationMetaTag={settings.htmlVerificationMetaTag}
              ingestApiBase={settings.ingestApiBase}
              sdkScriptUrl={settings.sdkScriptUrl}
              onConnectionUpdate={handleSettingsUpdate}
            />
          ) : null}

          {activeSection === "project" ? (
            <SettingsProjectDetailsSection landingPage={settings.landingPage} />
          ) : null}

          {activeSection === "activity" ? (
            <SettingsActivityLogSection
              publicId={settings.landingPage.publicId}
              isActive={activeSection === "activity"}
            />
          ) : null}

          {activeSection === "danger" ? (
            <SettingsDangerZoneSection landingPage={settings.landingPage} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
