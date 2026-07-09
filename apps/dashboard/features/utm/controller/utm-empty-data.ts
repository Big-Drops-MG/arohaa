import type { UtmDashboardData } from "@/features/utm/model/utm"

export function getUtmEmptyDashboardData(
  _landingPagePublicId: string,
  brandName = ""
): UtmDashboardData {
  return {
    brandName,
    stats: {
      total: 0,
      activeSource: 0,
      activeS1: 0,
      blockedSource: 0,
      blockedS1: 0,
    },
    activeItems: [],
    blockedItems: [],
    items: [],
  }
}
