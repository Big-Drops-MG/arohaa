import { NextResponse } from "next/server"
import { revokeWorkspaceApiKey } from "@/lib/server/workspace-api-keys"
import { route } from "@/lib/server/route"

export const DELETE = route(
  {
    permission: "api_keys.write",
    actor: "write",
    tab: "workspace",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const result = await revokeWorkspaceApiKey(actor.id, params.id!)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  }
)
