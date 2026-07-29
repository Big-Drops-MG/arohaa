import { SegmentGroup } from "../model/segment-model"

export async function fetchSegmentPreviewCount(
  workspaceId: string,
  conditions: SegmentGroup
): Promise<number> {
  const res = await fetch("/api/proxy/v1/segments/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspace_id: workspaceId, conditions }),
  })

  if (!res.ok) {
    throw new Error("Failed to fetch preview count")
  }

  const data = await res.json()
  return data.count
}

export async function saveSegment(
  workspaceId: string,
  name: string,
  description: string | undefined,
  conditions: SegmentGroup
) {
  const res = await fetch("/api/proxy/v1/segments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      name,
      description,
      conditions,
    }),
  })

  if (!res.ok) {
    throw new Error("Failed to save segment")
  }

  return res.json()
}
