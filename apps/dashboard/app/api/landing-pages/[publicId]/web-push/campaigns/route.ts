import { NextResponse } from "next/server"
import { z } from "zod"
import { route } from "@/lib/server/route"
import {
  createWebPushCampaignForLanding,
  loadNotificationCenterDashboard,
} from "@/lib/server/web-push-dashboard"

const clickSchema = z.object({
  mode: z.enum(["fixed", "template", "last_url"]),
  urlTemplate: z.string().nullable().optional(),
  fixedUrl: z.string().nullable().optional(),
  appendUtms: z.record(z.string(), z.string()).nullable().optional(),
  maskedRedirect: z.boolean().nullable().optional(),
  resumeMode: z.enum(["frozen", "fresh"]).nullable().optional(),
})

const dripStepSchema = z.object({
  delayMs: z.number().int().nonnegative(),
  title: z.string().max(64).nullable().optional(),
  body: z.string().max(500).nullable().optional(),
  tag: z.string().max(64).nullable().optional(),
  iconUrl: z.string().nullable().optional(),
  badgeUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})

const triggerSchema = z.object({
  type: z.enum(["delay_after_event", "immediate", "drip"]),
  event: z.string().nullable().optional(),
  delayMs: z.number().int().nonnegative().nullable().optional(),
  cancelOn: z.array(z.string()).nullable().optional(),
  steps: z.array(dripStepSchema).nullable().optional(),
})

const limitsSchema = z
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
  .optional()

const createSchema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().min(1).max(64),
  body: z.string().max(500).nullable().optional(),
  iconUrl: z.string().nullable().optional(),
  badgeUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  tag: z.string().max(64).nullable().optional(),
  requireInteraction: z.boolean().optional(),
  click: clickSchema,
  trigger: triggerSchema,
  limits: limitsSchema,
  status: z.enum(["draft", "active", "paused"]).optional(),
})

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const res = await loadNotificationCenterDashboard(
      actor.id,
      params.publicId!
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json({ campaigns: res.data.campaigns })
  }
)

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "notification-center",
    rateLimit: "landing",
    schema: createSchema,
  },
  async ({ actor, params, body }) => {
    const res = await createWebPushCampaignForLanding(
      actor.id,
      params.publicId!,
      body
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json({ campaignId: res.campaignId })
  }
)
