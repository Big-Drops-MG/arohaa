import {
  PROJECT_TABS,
  type ProjectTabValue,
} from "@/features/dashboard/model/project-tab"

export type PrivilegeSectionDef = {
  id: string
  label: string
}

export type PrivilegeTabDef = {
  value: ProjectTabValue
  label: string
  sections: PrivilegeSectionDef[]
}

/** Settings danger is never grantable to external members. */
export const EXTERNAL_PRIVILEGE_TABS: PrivilegeTabDef[] = PROJECT_TABS.map(
  (tab) => {
    const sections: PrivilegeSectionDef[] = (() => {
      switch (tab.value) {
        case "settings":
          return [
            { id: "general", label: "General" },
            { id: "publishing", label: "Publishing" },
            { id: "tracking", label: "SDK & tracking" },
            { id: "experiment", label: "Experiment" },
            { id: "project", label: "Project" },
            { id: "activity", label: "Activity" },
          ]
        case "heatmap":
          return [
            { id: "click", label: "Click" },
            { id: "scroll", label: "Scroll" },
            { id: "attention", label: "Attention" },
            { id: "form", label: "Form" },
          ]
        case "segments":
          return [
            { id: "all", label: "All traffic" },
            { id: "performance", label: "Performance" },
            { id: "cohort", label: "Cohort" },
            { id: "saved", label: "Saved" },
          ]
        case "traffic":
          return [
            { id: "time", label: "Time" },
            { id: "location", label: "Location" },
            { id: "device", label: "Device" },
            { id: "sources", label: "Sources" },
            { id: "pages", label: "Top pages" },
          ]
        case "overview":
          return [
            { id: "kpis", label: "KPIs" },
            { id: "funnel", label: "Funnel" },
            { id: "performance", label: "Performance" },
            { id: "traffic", label: "Traffic" },
            { id: "segments", label: "Segments" },
            { id: "alerts", label: "Alerts" },
          ]
        case "data-lab":
          return [
            { id: "level-1", label: "Level 1" },
            { id: "level-2", label: "Level 2" },
            { id: "leads", label: "Leads table" },
          ]
        default:
          return []
      }
    })()

    return {
      value: tab.value,
      label: tab.label,
      sections,
    }
  }
)

export type ExternalPrivilegeGrant = {
  landingPagePublicId: string
  tab: ProjectTabValue
  section: string
}

export type ExternalProjectScope = {
  landingPagePublicId: string
  utmSource: string
}

export function isExternalTeamKind(
  teamKind: string | null | undefined
): boolean {
  return teamKind === "external"
}
