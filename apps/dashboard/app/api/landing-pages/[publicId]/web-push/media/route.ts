import { NextResponse } from "next/server"
import { route } from "@/lib/server/route"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import {
  isWebPushMediaUploadConfigured,
  uploadWebPushMedia,
  type WebPushMediaKind,
} from "@/lib/server/web-push-media"

const KINDS = new Set<WebPushMediaKind>(["icon", "badge", "image"])

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async () => {
    return NextResponse.json({
      configured: isWebPushMediaUploadConfigured(),
    })
  }
)

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    const landing = await getActiveLandingPageForActor(
      actor.id,
      params.publicId!
    )
    if (!landing) {
      return NextResponse.json(
        { error: "Landing page not found" },
        { status: 404 }
      )
    }

    const form = await request.formData()
    const kindRaw = String(form.get("kind") ?? "icon")
    const kind = KINDS.has(kindRaw as WebPushMediaKind)
      ? (kindRaw as WebPushMediaKind)
      : null
    if (!kind) {
      return NextResponse.json(
        { error: "kind must be icon, badge, or image" },
        { status: 400 }
      )
    }

    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const result = await uploadWebPushMedia({
      landingPageId: landing.id,
      kind,
      fileName: file.name || `${kind}.png`,
      contentType: file.type || "application/octet-stream",
      bytes,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json({
      publicUrl: result.publicUrl,
      assetId: result.assetId,
    })
  }
)
