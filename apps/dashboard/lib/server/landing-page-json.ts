import type { InferSelectModel } from "drizzle-orm"
import type { landingPages } from "@workspace/database"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import type { LandingPageRecord } from "@/features/settings/model/landing-page-settings"
import { isLandingPageLive } from "@/lib/server/landing-page-live"

type LandingRow = InferSelectModel<typeof landingPages>

export function toLandingPageRecord(row: LandingRow): LandingPageRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    publicId: row.publicId,
    brandName: row.brandName,
    landingPageUrl: row.landingPageUrl,
    normalizedUrl: row.normalizedUrl,
    origin: row.origin,
    hostname: row.hostname,
    status: row.status,
    sdkInstallStatus: row.sdkInstallStatus,
    verificationMethod: row.verificationMethod,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    formType: parseOverviewLandingFormType(row.formType),
    faviconUrl: row.faviconUrl,
    notes: row.notes,
    isLive: isLandingPageLive(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
