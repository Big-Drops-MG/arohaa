import { z } from "zod"
import {
  WORKSPACE_API_KEY_SCOPE_ANALYTICS,
  WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
} from "@workspace/database/workspace-api-keys/scopes"

export const utmPutBodySchema = z
  .object({
    items: z.array(
      z
        .object({
          key: z.string(),
          value: z.string(),
          status: z.enum(["active", "blocked"]),
        })
        .strict()
    ),
  })
  .strict()

export const seoPostBodySchema = z
  .object({
    rows: z.array(
      z
        .object({
          id: z.string(),
          query: z.string(),
          pageUrl: z.string(),
          clicks: z.number(),
          impressions: z.number(),
          ctr: z.number(),
          position: z.number(),
          reportDate: z.string(),
        })
        .strict()
    ),
  })
  .strict()

export const alertWebhookCreateBodySchema = z
  .object({
    name: z.string(),
    url: z.string(),
  })
  .strict()

export const alertWebhookPatchBodySchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict()

const experimentVariantLinkSchema = z
  .object({
    label: z.string(),
    landingPageId: z.string().min(1),
  })
  .strict()

export const experimentCreateBodySchema = z
  .object({
    name: z.string(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().nullable().optional(),
    noEndDate: z.boolean().optional(),
    variants: z.array(experimentVariantLinkSchema).optional(),
    controlLandingPageId: z.string().nullable().optional(),
  })
  .strict()

export const experimentUpdateBodySchema = z
  .object({
    name: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().nullable().optional(),
    noEndDate: z.boolean().optional(),
    variants: z.array(experimentVariantLinkSchema).optional(),
    controlLandingPageId: z.string().nullable().optional(),
  })
  .strict()

export const experimentMembershipAttachBodySchema = z
  .object({
    parentPublicId: z.string().min(1),
    label: z.string(),
  })
  .strict()

export const experimentMembershipRenameBodySchema = z
  .object({
    label: z.string(),
  })
  .strict()

const landingPageFormTypeSchema = z.enum(["single", "multiple", "zip", "none"])

export const landingPageCreateBodySchema = z
  .object({
    brandName: z.string(),
    landingPageUrl: z.string(),
    formType: landingPageFormTypeSchema.optional(),
    faviconUrl: z.string().optional(),
    variantOf: z.string().optional(),
    variantLabel: z.string().optional(),
  })
  .strict()

export const landingPagePatchBodySchema = z
  .object({
    brandName: z.string().optional(),
    landingPageUrl: z.string().optional(),
    formType: landingPageFormTypeSchema.optional(),
    faviconUrl: z.string().optional(),
    notes: z.union([z.string(), z.null()]).optional(),
    redirectPageUrl: z.union([z.string(), z.null()]).optional(),
    isLive: z.boolean().optional(),
    services: z.unknown().optional(),
    channelType: z.unknown().optional(),
    channelTypes: z.unknown().optional(),
  })
  .strict()

export const segmentDefinitionCreateBodySchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    conditions: z.unknown(),
  })
  .strict()
  .refine((body) => body.conditions !== null && body.conditions !== undefined, {
    message: "conditions are required",
  })

export const segmentPreviewBodySchema = z
  .object({
    conditions: z.unknown(),
  })
  .strict()
  .refine((body) => body.conditions !== null && body.conditions !== undefined, {
    message: "conditions are required",
  })

const workspaceApiKeyScopeSchema = z.enum([
  WORKSPACE_API_KEY_SCOPE_ANALYTICS,
  WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
])

export const workspaceApiKeyCreateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(workspaceApiKeyScopeSchema).min(1).optional(),
  })
  .strict()

const activityEventTypeSchema = z.enum([
  "page_view",
  "tab_view",
  "button_click",
  "nav_click",
  "action",
])

export const activityIngestBodySchema = z
  .object({
    events: z
      .array(
        z
          .object({
            eventType: activityEventTypeSchema.optional(),
            summary: z.string().optional(),
            path: z.string().optional(),
            tab: z.string().optional(),
            projectPublicId: z.string().optional(),
            targetLabel: z.string().optional(),
            targetHref: z.string().optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
          })
          .strict()
      )
      .min(1)
      .max(40),
  })
  .strict()
