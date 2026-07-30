import type {
  SavedSegment,
  SegmentGroup,
} from "@/features/segments/model/segment-model"

function segmentsBasePath(projectId: string): string {
  return `/api/landing-pages/${encodeURIComponent(projectId)}/segments`
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  if (body && typeof body === "object" && "error" in body) {
    const value = (body as { error?: unknown }).error
    if (typeof value === "string" && value) return value
  }
  return fallback
}

export async function fetchSegmentPreviewCount(
  projectId: string,
  conditions: SegmentGroup,
  signal?: AbortSignal
): Promise<number> {
  const res = await fetch(`${segmentsBasePath(projectId)}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conditions }),
    cache: "no-store",
    signal,
  })

  if (!res.ok) {
    throw new Error(await readError(res, "Failed to load preview count"))
  }

  const data = (await res.json()) as { count?: number }
  return data.count ?? 0
}

export async function fetchSavedSegments(
  projectId: string,
  signal?: AbortSignal
): Promise<SavedSegment[]> {
  const res = await fetch(`${segmentsBasePath(projectId)}/definitions`, {
    cache: "no-store",
    signal,
  })

  if (!res.ok) {
    throw new Error(await readError(res, "Failed to load segments"))
  }

  return (await res.json()) as SavedSegment[]
}

export async function saveSegment(
  projectId: string,
  name: string,
  description: string | undefined,
  conditions: SegmentGroup
): Promise<SavedSegment> {
  const res = await fetch(`${segmentsBasePath(projectId)}/definitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, conditions }),
  })

  if (!res.ok) {
    throw new Error(await readError(res, "Failed to save segment"))
  }

  return (await res.json()) as SavedSegment
}

export async function deleteSegment(
  projectId: string,
  segmentId: string
): Promise<void> {
  const res = await fetch(
    `${segmentsBasePath(projectId)}/definitions/${encodeURIComponent(segmentId)}`,
    { method: "DELETE" }
  )

  if (!res.ok) {
    throw new Error(await readError(res, "Failed to delete segment"))
  }
}
