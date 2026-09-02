import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Permission } from "@workspace/database/schema/access-roles"
import type { RouteSectionConfig } from "@/lib/server/route-section"
import type { RouteGuardConfig } from "@/lib/server/route-guard"
import type { RouteTab } from "@/lib/server/route"

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export type ScannedRouteHandler = RouteGuardConfig & {
  method: HttpMethod
  relPath: string
}

const PERMANENT_EXEMPT = new Set(["auth/[...nextauth]/route.ts"])

function extractBalancedBraces(source: string, openIndex: number): string {
  let depth = 0
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === "{") depth += 1
    else if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(openIndex, i + 1)
      }
    }
  }
  throw new Error(`Unbalanced braces at index ${openIndex}`)
}

function parseSectionConfig(
  configSource: string
): RouteSectionConfig | undefined {
  const stringMatch = configSource.match(/section:\s*["']([^"']+)["']/)
  if (stringMatch) return stringMatch[1]!

  const queryMatch = configSource.match(
    /section:\s*\{[\s\S]*?queryParam:\s*["']([^"']+)["']/
  )
  if (queryMatch) {
    const queryParam = queryMatch[1]!
    if (queryParam === "section") {
      return {
        queryParam,
        resolve: (raw) => raw?.trim() || "glance",
      }
    }
    if (queryParam === "mode") {
      return {
        queryParam,
        resolve: (raw) => raw?.trim() || "click",
      }
    }
    return { queryParam }
  }

  return undefined
}

function parseRouteConfigBlock(configSource: string): RouteGuardConfig {
  const permission = configSource.match(/permission:\s*["']([^"']+)["']/)?.[1]
  const actor = configSource.match(/actor:\s*["'](read|write)["']/)?.[1]
  const tab = configSource.match(/tab:\s*["']([^"']+)["']/)?.[1]

  if (!permission || !actor || !tab) {
    throw new Error(
      `Missing permission/actor/tab in route config: ${configSource.slice(0, 120)}`
    )
  }

  return {
    permission: permission as Permission,
    actor: actor as "read" | "write",
    tab: tab as RouteTab,
    section: parseSectionConfig(configSource),
    rateLimit: "landing",
  }
}

export function parseRouteHandlers(
  source: string,
  relPath: string
): ScannedRouteHandler[] {
  const handlers: ScannedRouteHandler[] = []
  const exportRe =
    /export\s+const\s+(GET|POST|PATCH|PUT|DELETE)\s*=\s*route\s*\(\s*/g

  let match: RegExpExecArray | null
  while ((match = exportRe.exec(source)) !== null) {
    const method = match[1] as HttpMethod
    const braceStart = source.indexOf("{", match.index + match[0].length)
    if (braceStart < 0) continue

    const configSource = extractBalancedBraces(source, braceStart)
    handlers.push({
      method,
      relPath,
      ...parseRouteConfigBlock(configSource),
    })
  }

  return handlers
}

export function listDashboardApiRouteFiles(apiRoot: string): string[] {
  const files: string[] = []

  function walk(dir: string, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(abs, rel)
      else if (entry.name === "route.ts") files.push(rel.replace(/\\/g, "/"))
    }
  }

  walk(apiRoot)
  return files.sort()
}

export function loadScannedRouteHandlers(
  apiRoot: string
): ScannedRouteHandler[] {
  const files = listDashboardApiRouteFiles(apiRoot).filter(
    (rel) => !PERMANENT_EXEMPT.has(rel)
  )

  const handlers: ScannedRouteHandler[] = []
  for (const rel of files) {
    const source = fs.readFileSync(path.join(apiRoot, rel), "utf8")
    if (!source.includes("@/lib/server/route")) {
      throw new Error(`Expected route() wrapper in ${rel}`)
    }
    handlers.push(...parseRouteHandlers(source, rel))
  }

  return handlers
}

export function apiRootFromModule(metaUrl: string): string {
  const __dirname = path.dirname(fileURLToPath(metaUrl))
  return path.resolve(__dirname, "../../app/api")
}

export function buildApiPath(
  relPath: string,
  params: Record<string, string>
): string {
  const withoutFile = relPath.replace(/\/route\.ts$/, "")
  const segments = withoutFile.split("/").map((segment) => {
    const dynamic = segment.match(/^\[(.+)\]$/)
    if (!dynamic) return segment
    const key = dynamic[1]!
    const value = params[key]
    if (!value) throw new Error(`Missing path param ${key} for ${relPath}`)
    return encodeURIComponent(value)
  })
  return `/api/${segments.join("/")}`
}

export function defaultPathParams(relPath: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const segment of relPath.split("/")) {
    const dynamic = segment.match(/^\[(.+)\]$/)
    if (dynamic) {
      params[dynamic[1]!] = `fixture-${dynamic[1]!}`
    }
  }
  if (params.publicId) params.publicId = "lp-project-a"
  if (params.userId) params.userId = "user-member"
  if (params.id) params.id = "fixture-id"
  if (params.segmentId) params.segmentId = "fixture-segment"
  if (params.experimentId) params.experimentId = "fixture-experiment"
  return params
}

export function isProjectScopedRoute(handler: ScannedRouteHandler): boolean {
  return handler.relPath.includes("[publicId]")
}

export function isTeamMemberLogsRoute(handler: ScannedRouteHandler): boolean {
  return handler.relPath === "team/members/[userId]/logs/route.ts"
}
