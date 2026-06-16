"use client"

import {
  Activity,
  AlertTriangle,
  Globe,
  Radio,
  Settings2,
  Shield,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export type SettingsSectionId =
  | "general"
  | "publishing"
  | "tracking"
  | "project"
  | "activity"
  | "danger"

export type SettingsNavItem = {
  id: SettingsSectionId
  label: string
  description: string
  icon: typeof Settings2
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: "general",
    label: "General",
    description: "Brand, URL, form type, notes",
    icon: Settings2,
  },
  {
    id: "publishing",
    label: "Publishing",
    description: "Live / not live tracking",
    icon: Radio,
  },
  {
    id: "tracking",
    label: "SDK & tracking",
    description: "Snippet, verification, connection",
    icon: Globe,
  },
  {
    id: "project",
    label: "Project info",
    description: "IDs, status, timestamps",
    icon: Shield,
  },
  {
    id: "activity",
    label: "Activity log",
    description: "Audit trail for this project",
    icon: Activity,
  },
  {
    id: "danger",
    label: "Delete project",
    description: "Permanently remove project",
    icon: AlertTriangle,
  },
]

type SettingsNavProps = {
  activeSection: SettingsSectionId
  onSectionChange: (section: SettingsSectionId) => void
}

export function SettingsNav({
  activeSection,
  onSectionChange,
}: SettingsNavProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-col gap-1 lg:sticky lg:top-4"
    >
      {SETTINGS_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = activeSection === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
              isActive
                ? "border-border bg-muted/60"
                : "border-transparent hover:border-border/60 hover:bg-muted/30",
              item.id === "danger" &&
                !isActive &&
                "text-destructive hover:text-destructive"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                item.id === "danger"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
