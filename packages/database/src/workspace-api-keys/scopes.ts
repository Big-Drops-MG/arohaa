export const WORKSPACE_API_KEY_SCOPE_ANALYTICS = 'analytics.read' as const
export const WORKSPACE_API_KEY_SCOPE_DATA_EXPORT = 'data_export.read' as const

export const WORKSPACE_API_KEY_SCOPES = [
  WORKSPACE_API_KEY_SCOPE_ANALYTICS,
  WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
] as const

export type WorkspaceApiKeyScope = (typeof WORKSPACE_API_KEY_SCOPES)[number]
