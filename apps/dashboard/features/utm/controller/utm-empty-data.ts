import type { UtmDashboardData } from "@/features/utm/model/utm"

export function getUtmEmptyDashboardData(
  _landingPagePublicId: string,
  brandName = ""
): UtmDashboardData {
  return {
    brandName,
    stats: {
      total: 0,
      active: 0,
      blocked: 0,
      activePct: 0,
      blockedPct: 0,
    },
    activeItems: [],
    blockedItems: [],
    items: [],
  }
}
