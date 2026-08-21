"use client"

import { useCallback, useMemo, useState } from "react"
import type { LandingPageSettingsData } from "@/features/settings/model/landing-page-settings"
import { SettingsActivityLogSection } from "@/features/settings/view/SettingsActivityLogSection"
import { SettingsConnectionSection } from "@/features/settings/view/SettingsConnectionSection"
import { SettingsDangerZoneSection } from "@/features/settings/view/SettingsDangerZoneSection"
import { SettingsExperimentSection } from "@/features/settings/view/SettingsExperimentSection"
import { SettingsGeneralSection } from "@/features/settings/view/SettingsGeneralSection"
import { SettingsLiveSection } from "@/features/settings/view/SettingsLiveSection"
import {
  SETTINGS_NAV_ITEMS,
  SettingsNav,
  type SettingsNavItem,
  type SettingsSectionId,
} from "@/features/settings/view/SettingsNav"
import { SettingsProjectDetailsSection } from "@/features/settings/view/SettingsProjectDetailsSection"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"

type SettingsDashboardProps = {
  initialData: LandingPageSettingsData
  projectId: string
  allowedSections?: string[] | null
  readOnly?: boolean
}

export function SettingsDashboard({
  initialData,
  projectId,
  allowedSections = null,
  readOnly = false,
}: SettingsDashboardProps) {
  const [settings, setSettings] = useState(initialData)

  const navItems = useMemo((): SettingsNavItem[] => {
    if (!allowedSections) return SETTINGS_NAV_ITEMS
    const allowed = new Set(allowedSections)
    return SETTINGS_NAV_ITEMS.filter(
      (item) => item.id !== "danger" && allowed.has(item.id)
    )
  }, [allowedSections])

  const parseSettingsSection = useCallback(
    (value: string | null): SettingsSectionId => {
      if (value && navItems.some((item) => item.id === value)) {
        return value as SettingsSectionId
      }
      return (navItems[0]?.id ?? "general") as SettingsSectionId
    },
    [navItems]
  )

  const [activeSection, setActiveSection] = useDashboardQueryParam("section", {
    parse: parseSettingsSection,
    projectId,
    omitDefault: true,
  })

  const handleSettingsUpdate = useCallback((next: LandingPageSettingsData) => {
    setSettings(next)
  }, [])

  const canShow = (id: SettingsSectionId) =>
    !allowedSections || allowedSections.includes(id)

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {readOnly
            ? "View project settings for "
            : "Manage project details, SDK tracking, publishing status, activity logs, and lifecycle actions for "}
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
          items={navItems}
        />

        <div
          className={
            readOnly
              ? "pointer-events-none min-w-0 space-y-4 opacity-90 select-none"
              : "min-w-0 space-y-4"
          }
        >
          {activeSection === "general" && canShow("general") ? (
            <SettingsGeneralSection
              key={settings.landingPage.updatedAt}
              landingPage={settings.landingPage}
              onSaved={handleSettingsUpdate}
            />
          ) : null}

          {activeSection === "publishing" && canShow("publishing") ? (
            <SettingsLiveSection
              key={`live-${settings.landingPage.updatedAt}`}
              landingPage={settings.landingPage}
              settings={settings}
              onUpdated={handleSettingsUpdate}
            />
          ) : null}

          {activeSection === "tracking" && canShow("tracking") ? (
            <SettingsConnectionSection
              landingPage={settings.landingPage}
              sdkSnippetHtml={settings.sdkSnippetHtml}
              htmlVerificationMetaTag={settings.htmlVerificationMetaTag}
              ingestApiBase={settings.ingestApiBase}
              sdkScriptUrl={settings.sdkScriptUrl}
              onConnectionUpdate={handleSettingsUpdate}
            />
          ) : null}

          {activeSection === "experiment" && canShow("experiment") ? (
            <SettingsExperimentSection
              key={`experiment-${settings.landingPage.publicId}`}
              landingPage={settings.landingPage}
            />
          ) : null}

          {activeSection === "project" && canShow("project") ? (
            <SettingsProjectDetailsSection landingPage={settings.landingPage} />
          ) : null}

          {activeSection === "activity" && canShow("activity") ? (
            <SettingsActivityLogSection
              publicId={settings.landingPage.publicId}
              isActive={activeSection === "activity"}
            />
          ) : null}

          {activeSection === "danger" && !allowedSections ? (
            <SettingsDangerZoneSection landingPage={settings.landingPage} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
