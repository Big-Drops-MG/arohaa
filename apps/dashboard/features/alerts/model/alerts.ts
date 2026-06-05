import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { OverviewAlert } from "@/features/overview/model/overview"

export type AlertsByDateRange = Record<OverviewDateRangeId, OverviewAlert[]>
