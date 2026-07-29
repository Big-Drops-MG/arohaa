import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

export type SegmentDefinition = {
  id: string
  workspaceId: string
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

async function resolveWorkspaceId(
  publicId: string
): Promise<SegmentDefinitionResult<string>> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const landingPage = await getActiveLandingPageForActor(actor.id, publicId)
  if (!landingPage) {
    return { ok: false, status: 404, error: "Not found" }
  }

  return { ok: true, data: landingPage.id }
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
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[segments] API ${resp.status} ${path}`,
          text.slice(0, 200)
        )
      }
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
    if (process.env.NODE_ENV === "development") {
      console.error("[segments] API request failed", err)
    }
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
  publicId: string
): Promise<SegmentDefinitionResult<SegmentDefinition[]>> {
  const workspace = await resolveWorkspaceId(publicId)
  if (!workspace.ok) return workspace

  return callSegmentsApi<SegmentDefinition[]>(
    `/v1/segments?workspace_id=${encodeURIComponent(workspace.data)}`,
    { method: "GET" }
  )
}

export async function createSegmentDefinition(
  publicId: string,
  input: { name: string; description?: string; conditions: unknown }
): Promise<SegmentDefinitionResult<SegmentDefinition>> {
  const workspace = await resolveWorkspaceId(publicId)
  if (!workspace.ok) return workspace

  return callSegmentsApi<SegmentDefinition>("/v1/segments", {
    method: "POST",
    body: {
      workspace_id: workspace.data,
      name: input.name,
      description: input.description,
      conditions: input.conditions,
    },
  })
}

export async function deleteSegmentDefinition(
  publicId: string,
  segmentId: string
): Promise<SegmentDefinitionResult<{ success: boolean }>> {
  const workspace = await resolveWorkspaceId(publicId)
  if (!workspace.ok) return workspace

  return callSegmentsApi<{ success: boolean }>(
    `/v1/segments/${encodeURIComponent(segmentId)}?workspace_id=${encodeURIComponent(workspace.data)}`,
    { method: "DELETE" }
  )
}

export async function previewSegmentDefinition(
  publicId: string,
  conditions: unknown
): Promise<SegmentDefinitionResult<{ count: number }>> {
  const workspace = await resolveWorkspaceId(publicId)
  if (!workspace.ok) return workspace

  return callSegmentsApi<{ count: number }>("/v1/segments/preview", {
    method: "POST",
    body: { workspace_id: workspace.data, conditions },
  })
}
