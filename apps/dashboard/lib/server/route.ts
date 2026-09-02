import "server-only"

import { NextResponse } from "next/server"
import type { ZodType } from "zod"
import type { InferSelectModel, Permission, users } from "@workspace/database"
import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"
import {
  evaluateRouteGuard,
  type RouteGuardConfig,
} from "@/lib/server/route-guard"

type UserRow = InferSelectModel<typeof users>
export type RateLimitBucket = "landing"

export type RouteTab = ProjectTabValue | "workspace" | "collection"

type RouteContext = {
  params: Promise<Record<string, string>>
}

type RouteHandlerCtx<TBody> = {
  actor: UserRow
  body: TBody
  params: Record<string, string>
  request: Request
}

type RouteBaseConfig = RouteGuardConfig

export type RouteReadConfig = RouteBaseConfig & {
  actor: "read"
  schema?: undefined
}

export type RouteReadBodyConfig<TBody> = RouteBaseConfig & {
  actor: "read"
  schema: ZodType<TBody>
}

export type RouteWriteConfig<TBody> = RouteBaseConfig & {
  actor: "write"
  schema: ZodType<TBody>
}

export type RouteWriteNoBodyConfig = RouteBaseConfig & {
  actor: "write"
  schema?: undefined
}

function guardFailureResponse(result: {
  ok: false
  status: 401 | 403 | 429 | 400
}): Response {
  const message =
    result.status === 401
      ? "Unauthorized"
      : result.status === 403
        ? "Forbidden"
        : result.status === 429
          ? "Too many requests"
          : "Invalid request"
  return NextResponse.json({ error: message }, { status: result.status })
}

async function runRoute<TBody>(
  request: Request,
  context: RouteContext,
  cfg:
    | RouteReadConfig
    | RouteReadBodyConfig<TBody>
    | RouteWriteConfig<TBody>
    | RouteWriteNoBodyConfig,
  handler: (ctx: RouteHandlerCtx<TBody>) => Promise<Response>
): Promise<Response> {
  const params = await context.params
  const guard = await evaluateRouteGuard(cfg, request, params)
  if (!guard.ok) return guardFailureResponse(guard)

  let body = undefined as TBody
  if (cfg.schema) {
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = cfg.schema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }
    body = parsed.data
  }

  return handler({
    actor: guard.actor as UserRow,
    body,
    params,
    request,
  })
}

export function route(
  cfg: RouteReadConfig,
  handler: (ctx: RouteHandlerCtx<void>) => Promise<Response>
): (request: Request, context: RouteContext) => Promise<Response>

export function route<TBody>(
  cfg: RouteReadBodyConfig<TBody>,
  handler: (ctx: RouteHandlerCtx<TBody>) => Promise<Response>
): (request: Request, context: RouteContext) => Promise<Response>

export function route(
  cfg: RouteWriteNoBodyConfig,
  handler: (ctx: RouteHandlerCtx<void>) => Promise<Response>
): (request: Request, context: RouteContext) => Promise<Response>

export function route<TBody>(
  cfg: RouteWriteConfig<TBody>,
  handler: (ctx: RouteHandlerCtx<TBody>) => Promise<Response>
): (request: Request, context: RouteContext) => Promise<Response>

export function route<TBody>(
  cfg:
    | RouteReadConfig
    | RouteReadBodyConfig<TBody>
    | RouteWriteConfig<TBody>
    | RouteWriteNoBodyConfig,
  handler: (ctx: RouteHandlerCtx<TBody | void>) => Promise<Response>
) {
  return (request: Request, context: RouteContext) =>
    runRoute(
      request,
      context,
      cfg,
      handler as (ctx: RouteHandlerCtx<TBody>) => Promise<Response>
    )
}

export type { Permission, RouteGuardConfig }
