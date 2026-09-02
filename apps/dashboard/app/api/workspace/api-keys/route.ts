import { NextResponse } from "next/server"
import {
  createWorkspaceApiKey,
  listWorkspaceApiKeys,
} from "@/lib/server/workspace-api-keys"
import { route } from "@/lib/server/route"
import { workspaceApiKeyCreateBodySchema } from "@/lib/server/route-schemas"

export const GET = route(
  {
    permission: "api_keys.write",
    actor: "read",
    tab: "workspace",
    rateLimit: "landing",
  },
  async ({ actor }) => {
    const items = await listWorkspaceApiKeys(actor.id)
    return NextResponse.json({ items })
  }
)

export const POST = route(
  {
    permission: "api_keys.write",
    actor: "write",
    tab: "workspace",
    rateLimit: "landing",
    schema: workspaceApiKeyCreateBodySchema,
  },
  async ({ actor, body }) => {
    const result = await createWorkspaceApiKey(actor, actor.id, {
      name: body.name,
      scopes: body.scopes,
    })
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      item: result.item,
      key: result.key,
    })
  }
)
