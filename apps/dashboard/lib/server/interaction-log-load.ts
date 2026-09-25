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
} from "@/features/data-export/model/interaction-log"

export type { InteractionLogData, InteractionLogEntry }

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
        entries: Array.isArray(data.entries) ? data.entries : [],
      },
    }
  } catch {
    return { ok: false, status: 502, error: "Could not load interaction log" }
  }
}
