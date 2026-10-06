import {
  buildInternalUserDelegationHeaders,
  FUNNEL_LEADS_DELEGATION_SCOPE,
} from "@workspace/database"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { canAccessLeadsForLandingPage } from "@/lib/server/data-export-acl"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

import type {
  InteractionLogData,
  InteractionLogEntry,
  LeadFraudAssessment,
} from "@/features/data-export/model/interaction-log"

export type { InteractionLogData, InteractionLogEntry, LeadFraudAssessment }

function mapFraud(raw: unknown): LeadFraudAssessment | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const rawLabel = row.label === "review" ? "fraud" : row.label
  const rawEffective =
    row.effectiveLabel === "review" ? "fraud" : row.effectiveLabel
  if (rawLabel !== "legit" && rawLabel !== "fraud") return null
  const effective =
    rawEffective === "legit" || rawEffective === "fraud"
      ? rawEffective
      : rawLabel
  return {
    score: typeof row.score === "number" ? row.score : 0,
    label: rawLabel,
    effectiveLabel: effective,
    reasons: Array.isArray(row.reasons)
      ? row.reasons.map((r) => String(r))
      : [],
    modelVersion: typeof row.modelVersion === "string" ? row.modelVersion : "",
  }
}

export async function loadInteractionLogForApi(
  landingPagePublicId: string,
  sessionId: string
): Promise<
  | { ok: true; data: InteractionLogData }
  | { ok: false; status: number; error: string }
> {
  const sid = sessionId.trim()
  if (!sid || sid.length > 128) {
    return { ok: false, status: 400, error: "Invalid session_id" }
  }

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  if (!(await canAccessLeadsForLandingPage(actor, landingPagePublicId))) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) {
    return { ok: false, status: 503, error: "Analytics not configured" }
  }

  const delegationHeaders = buildInternalUserDelegationHeaders(secret, {
    userId: actor.id,
    landingPageId: row.id,
    scope: FUNNEL_LEADS_DELEGATION_SCOPE,
  })

  const url = new URL(`${apiBase}/v1/analytics/funnel/leads/interaction-log`)
  url.searchParams.set("workspace_id", row.id)
  url.searchParams.set("session_id", sid)

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-arohaa-internal": secret,
        ...delegationHeaders,
      },
      cache: "no-store",
    })
    if (!res.ok) {
      return {
        ok: false,
        status: res.status === 401 || res.status === 403 ? res.status : 502,
        error: "Could not load interaction log",
      }
    }
    const data = (await res.json()) as InteractionLogData
    return {
      ok: true,
      data: {
        sessionId: typeof data.sessionId === "string" ? data.sessionId : sid,
        startedAt:
          typeof data.startedAt === "string" || data.startedAt === null
            ? data.startedAt
            : null,
        formId:
          typeof data.formId === "string" && data.formId.trim()
            ? data.formId.trim()
            : null,
        firstName:
          typeof data.firstName === "string" ? data.firstName.trim() : "",
        lastName: typeof data.lastName === "string" ? data.lastName.trim() : "",
        email: typeof data.email === "string" ? data.email.trim() : "",
        fraud: mapFraud(data.fraud),
        entries: Array.isArray(data.entries)
          ? data.entries.map((entry) => ({
              at: typeof entry?.at === "string" ? entry.at : "",
              offsetMs:
                typeof entry?.offsetMs === "number" &&
                Number.isFinite(entry.offsetMs)
                  ? entry.offsetMs
                  : 0,
              message: typeof entry?.message === "string" ? entry.message : "",
              kind:
                typeof entry?.kind === "number" && Number.isFinite(entry.kind)
                  ? entry.kind
                  : null,
            }))
          : [],
      },
    }
  } catch {
    return { ok: false, status: 502, error: "Could not load interaction log" }
  }
}
