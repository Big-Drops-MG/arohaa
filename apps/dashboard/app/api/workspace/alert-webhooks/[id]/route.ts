import { NextResponse } from "next/server"
import {
  deleteWorkspaceAlertWebhook,
  setWorkspaceAlertWebhookEnabled,
} from "@/lib/server/workspace-alert-webhooks"
import { route } from "@/lib/server/route"
import { alertWebhookPatchBodySchema } from "@/lib/server/route-schemas"

export const PATCH = route(
  {
    permission: "webhooks.write",
    actor: "write",
    tab: "workspace",
    rateLimit: "landing",
    schema: alertWebhookPatchBodySchema,
  },
  async ({ actor, body, params }) => {
    const result = await setWorkspaceAlertWebhookEnabled(
      actor.id,
      params.id!,
      body.enabled
    )
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ item: result.item })
  }
)

export const DELETE = route(
  {
    permission: "webhooks.write",
    actor: "write",
    tab: "workspace",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const result = await deleteWorkspaceAlertWebhook(actor.id, params.id!)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  }
)
