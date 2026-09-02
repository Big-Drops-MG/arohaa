import { NextResponse } from "next/server"
import {
  createWorkspaceAlertWebhook,
  listWorkspaceAlertWebhooks,
} from "@/lib/server/workspace-alert-webhooks"
import { route } from "@/lib/server/route"
import { alertWebhookCreateBodySchema } from "@/lib/server/route-schemas"

export const GET = route(
  {
    permission: "webhooks.write",
    actor: "read",
    tab: "workspace",
    rateLimit: "landing",
  },
  async ({ actor }) => {
    const items = await listWorkspaceAlertWebhooks(actor.id)
    return NextResponse.json({ items })
  }
)

export const POST = route(
  {
    permission: "webhooks.write",
    actor: "write",
    tab: "workspace",
    rateLimit: "landing",
    schema: alertWebhookCreateBodySchema,
  },
  async ({ actor, body }) => {
    const result = await createWorkspaceAlertWebhook(actor.id, {
      name: body.name,
      url: body.url,
    })
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ item: result.item })
  }
)
