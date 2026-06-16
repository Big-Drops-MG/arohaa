import type { InferSelectModel } from "drizzle-orm"
import type { landingPages } from "@workspace/database"

type LandingRow = InferSelectModel<typeof landingPages>

export function isLandingPageLive(status: string): boolean {
  return status !== "inactive" && status !== "archived"
}

export function resolveLiveStatusChange(
  row: LandingRow,
  isLive: boolean
): {
  status: string
  metadata: Record<string, unknown> | null
} | null {
  const currentlyLive = isLandingPageLive(row.status)

  if (isLive === currentlyLive) {
    return null
  }

  if (isLive) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    const previousStatus =
      typeof meta.previousStatus === "string" && meta.previousStatus.length > 0
        ? meta.previousStatus
        : row.verifiedAt != null
          ? "verified"
          : "pending_verification"

    const { previousStatus: _removed, ...rest } = meta
    void _removed

    return {
      status: previousStatus,
      metadata: Object.keys(rest).length > 0 ? rest : null,
    }
  }

  if (row.status === "archived") {
    return null
  }

  const meta = (row.metadata ?? {}) as Record<string, unknown>

  return {
    status: "inactive",
    metadata: {
      ...meta,
      previousStatus: row.status,
    },
  }
}
