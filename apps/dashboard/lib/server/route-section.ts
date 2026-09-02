import { mapLegacyInsightSectionToDataLab } from "../../features/data-lab/model/data-lab-sections.js"
import { parseInsightSection } from "../../features/insights/model/insights-section.js"
import { parseHeatmapMode } from "../../features/heatmap/model/heatmap.js"

export type RouteSectionConfig =
  | string
  | {
      queryParam: string
      resolve?: (raw: string | null) => string
    }

export function insightSectionToAclSection(raw: string | null): string {
  return mapLegacyInsightSectionToDataLab(parseInsightSection(raw))
}

export function heatmapModeToAclSection(raw: string | null): string {
  return parseHeatmapMode(raw ?? undefined)
}

export function resolveRouteSectionId(
  cfg: RouteSectionConfig,
  request: Request
): string {
  if (typeof cfg === "string") return cfg
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get(cfg.queryParam)
  return cfg.resolve ? cfg.resolve(raw) : (raw?.trim() ?? "")
}
