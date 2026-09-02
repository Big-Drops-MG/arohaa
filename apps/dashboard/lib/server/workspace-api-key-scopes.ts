import type { Permission } from "@workspace/database"
import {
  WORKSPACE_API_KEY_SCOPE_ANALYTICS,
  WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
  WORKSPACE_API_KEY_SCOPES,
  type WorkspaceApiKeyScope,
} from "@workspace/database/workspace-api-keys/scopes"
import { actorCan, type Actor } from "@/lib/server/actor-can"

const SCOPE_REQUIRED_PERMISSION: Record<WorkspaceApiKeyScope, Permission> = {
  [WORKSPACE_API_KEY_SCOPE_ANALYTICS]: "landing_pages.read",
  [WORKSPACE_API_KEY_SCOPE_DATA_EXPORT]: "data_export.read",
}

export function isWorkspaceApiKeyScope(
  value: string
): value is WorkspaceApiKeyScope {
  return (WORKSPACE_API_KEY_SCOPES as readonly string[]).includes(value)
}

export async function actorHoldsScopeGrant(
  actor: Actor,
  scope: WorkspaceApiKeyScope
): Promise<boolean> {
  return actorCan(actor, SCOPE_REQUIRED_PERMISSION[scope])
}

export async function validateRequestedApiKeyScopes(
  actor: Actor,
  scopes: string[]
): Promise<{ ok: true; scopes: WorkspaceApiKeyScope[] } | { error: string }> {
  if (scopes.length === 0) {
    return { error: "At least one scope is required" }
  }

  const unique = [...new Set(scopes.map((scope) => scope.trim()))]
  const resolved: WorkspaceApiKeyScope[] = []

  for (const scope of unique) {
    if (!isWorkspaceApiKeyScope(scope)) {
      return { error: `Invalid scope: ${scope}` }
    }
    resolved.push(scope)
  }

  for (const scope of resolved) {
    if (!(await actorHoldsScopeGrant(actor, scope))) {
      return { error: "Cannot grant scopes you do not hold" }
    }
  }

  return { ok: true, scopes: resolved }
}
