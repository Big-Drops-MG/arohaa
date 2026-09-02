import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

export type SegmentDefinition = {
  id: string
  workspaceId: string
  landingPageId: string
  name: string
  description: string | null
  conditions: unknown
  createdAt: string
  updatedAt: string
}

export type SegmentDefinitionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

const REQUEST_TIMEOUT_MS = 12_000

type SegmentScope = {
  workspaceId: string
  landingPageId: string
}

async function resolveScope(
  actorId: string,
  publicId: string
): Promise<SegmentDefinitionResult<SegmentScope>> {
  const landingPage = await getActiveLandingPageForActor(actorId, publicId)
  if (!landingPage) {
    return { ok: false, status: 404, error: "Not found" }
  }

  return {
    ok: true,
    data: {
      workspaceId: landingPage.workspaceId,
      landingPageId: landingPage.id,
    },
  }
}

async function callSegmentsApi<T>(
  path: string,
  init: { method: string; body?: unknown }
): Promise<SegmentDefinitionResult<T>> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) {
    return { ok: false, status: 503, error: "Analytics API is not configured" }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const resp = await fetch(`${apiBase}${path}`, {
      method: init.method,
      headers: {
        "x-arohaa-internal": secret,
        ...(init.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      console.error(`[segments] API ${resp.status} ${path}`, text.slice(0, 200))
      return {
        ok: false,
        status: resp.status,
        error: "Segment request failed",
      }
    }

    return { ok: true, data: (await resp.json()) as T }
  } catch (err: unknown) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name?: string }).name)
        : ""
    console.error("[segments] API request failed", err)
    return {
      ok: false,
      status: name === "AbortError" ? 504 : 502,
      error: "Segment request failed",
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function listSegmentDefinitions(
  actorId: string,
  publicId: string
): Promise<SegmentDefinitionResult<SegmentDefinition[]>> {
  const scope = await resolveScope(actorId, publicId)
  if (!scope.ok) return scope

  return callSegmentsApi<SegmentDefinition[]>(
    `/v1/segments?landing_page_id=${encodeURIComponent(scope.data.landingPageId)}`,
    { method: "GET" }
  )
}

export async function createSegmentDefinition(
  actorId: string,
  publicId: string,
  input: { name: string; description?: string; conditions: unknown }
): Promise<SegmentDefinitionResult<SegmentDefinition>> {
  const scope = await resolveScope(actorId, publicId)
  if (!scope.ok) return scope

  return callSegmentsApi<SegmentDefinition>("/v1/segments", {
    method: "POST",
    body: {
      workspace_id: scope.data.workspaceId,
      landing_page_id: scope.data.landingPageId,
      name: input.name,
      description: input.description,
      conditions: input.conditions,
    },
  })
}

export async function deleteSegmentDefinition(
  actorId: string,
  publicId: string,
  segmentId: string
): Promise<SegmentDefinitionResult<{ success: boolean }>> {
  const scope = await resolveScope(actorId, publicId)
  if (!scope.ok) return scope

  return callSegmentsApi<{ success: boolean }>(
    `/v1/segments/${encodeURIComponent(segmentId)}?landing_page_id=${encodeURIComponent(scope.data.landingPageId)}`,
    { method: "DELETE" }
  )
}

export async function previewSegmentDefinition(
  actorId: string,
  publicId: string,
  conditions: unknown
): Promise<SegmentDefinitionResult<{ count: number }>> {
  const scope = await resolveScope(actorId, publicId)
  if (!scope.ok) return scope

  return callSegmentsApi<{ count: number }>("/v1/segments/preview", {
    method: "POST",
    body: { workspace_id: scope.data.landingPageId, conditions },
  })
}

export async function fetchSegmentColumnValues(
  actorId: string,
  publicId: string,
  column: string
): Promise<SegmentDefinitionResult<{ column: string; values: string[] }>> {
  const scope = await resolveScope(actorId, publicId)
  if (!scope.ok) return scope

  const qs = new URLSearchParams({
    workspace_id: scope.data.landingPageId,
    column,
  })

  return callSegmentsApi<{ column: string; values: string[] }>(
    `/v1/segments/column-values?${qs.toString()}`,
    { method: "GET" }
  )
}
