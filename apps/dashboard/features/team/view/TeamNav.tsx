"use client"

import { Building2, Clock3, UsersRound } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export type TeamSectionId = "internal" | "external" | "pending"

export type TeamNavItem = {
  id: TeamSectionId
  label: string
  description: string
  icon: typeof Building2
}

export const TEAM_NAV_ITEMS: TeamNavItem[] = [
  {
    id: "internal",
    label: "Internal Team",
    description: "Approved company members",
    icon: Building2,
  },
  {
    id: "external",
    label: "External Team",
    description: "Partners and collaborators",
    icon: UsersRound,
  },
  {
    id: "pending",
    label: "Pending Requests",
    description: "Awaiting access review",
    icon: Clock3,
  },
]

type TeamNavProps = {
  activeSection: TeamSectionId
  onSectionChange: (section: TeamSectionId) => void
  counts?: Partial<Record<TeamSectionId, number>>
}

export function TeamNav({
  activeSection,
  onSectionChange,
  counts,
}: TeamNavProps) {
  return (
    <nav
      aria-label="Team sections"
      className="flex flex-col gap-1 lg:sticky lg:top-4"
    >
      {TEAM_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = activeSection === item.id
        const count = counts?.[item.id]

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
              isActive
                ? "border-border bg-muted/60"
                : "border-transparent hover:border-border/60 hover:bg-muted/30"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className="mt-0.5 size-4 shrink-0 self-start text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
            {typeof count === "number" ? (
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
