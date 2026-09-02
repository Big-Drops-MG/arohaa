import { NextResponse } from "next/server"
import { testWorkspaceAlertWebhook } from "@/lib/server/workspace-alert-webhooks"
import { route } from "@/lib/server/route"

export const POST = route(
  {
    permission: "webhooks.write",
    actor: "write",
    tab: "workspace",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const result = await testWorkspaceAlertWebhook(actor.id, params.id!)

    if ("error" in result && !("item" in result)) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    if (!result.success) {
      return NextResponse.json(
        {
          item: result.item,
          success: false,
          error: result.error,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ item: result.item, success: true })
  }
)
