import { NextResponse } from "next/server"
import { z } from "zod"
import { route } from "@/lib/server/route"
import { updateWebPushCampaignForLanding } from "@/lib/server/web-push-dashboard"

const dripStepSchema = z.object({
  delayMs: z.number().int().nonnegative(),
  title: z.string().max(64).nullable().optional(),
  body: z.string().max(500).nullable().optional(),
  tag: z.string().max(64).nullable().optional(),
  iconUrl: z.string().nullable().optional(),
  badgeUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(64).optional(),
  body: z.string().max(500).nullable().optional(),
  iconUrl: z.string().nullable().optional(),
  badgeUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  tag: z.string().max(64).nullable().optional(),
  requireInteraction: z.boolean().optional(),
  click: z
    .object({
      mode: z.enum(["fixed", "template", "last_url"]),
      urlTemplate: z.string().nullable().optional(),
      fixedUrl: z.string().nullable().optional(),
      appendUtms: z.record(z.string(), z.string()).nullable().optional(),
      maskedRedirect: z.boolean().nullable().optional(),
      resumeMode: z.enum(["frozen", "fresh"]).nullable().optional(),
    })
    .optional(),
  trigger: z
    .object({
      type: z.enum(["delay_after_event", "immediate", "drip"]),
      event: z.string().nullable().optional(),
      delayMs: z.number().int().nonnegative().nullable().optional(),
      cancelOn: z.array(z.string()).nullable().optional(),
      steps: z.array(dripStepSchema).nullable().optional(),
    })
    .optional(),
  limits: z
    .object({
      maxPerUserPerDay: z.number().int().positive().nullable().optional(),
      ttlMs: z.number().int().positive().nullable().optional(),
      quietHours: z
        .object({
          start: z.string(),
          end: z.string(),
          tz: z.string(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  status: z.enum(["draft", "active", "paused"]).optional(),
})

export const PATCH = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "notification-center",
    rateLimit: "landing",
    schema: patchSchema,
  },
  async ({ actor, params, body }) => {
    const res = await updateWebPushCampaignForLanding(
      actor.id,
      params.publicId!,
      params.campaignId!,
      body
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json({ ok: true })
  }
)
