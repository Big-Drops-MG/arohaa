export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\r|\n|\t/g, " ")
}

export type LandingSdkSnippetInput = {
  sdkScriptUrl: string
  ingestApiBase: string
  workspaceUuid: string
  publicLandingId: string
  pageHostname: string
}

export function buildLandingSdkScriptTag(
  options: LandingSdkSnippetInput
): string {
  const src = escapeHtmlAttribute(options.sdkScriptUrl)
  const api = escapeHtmlAttribute(options.ingestApiBase)
  const wid = escapeHtmlAttribute(options.workspaceUuid)
  const lp = escapeHtmlAttribute(options.publicLandingId)
  const page = escapeHtmlAttribute(options.pageHostname)
  return `<script src="${src}" async data-wid="${wid}" data-api="${api}" data-lp-id="${lp}" data-page="${page}"></script>`
}

export function buildHtmlVerificationMetaTag(
  verificationToken: string
): string {
  const tok = escapeHtmlAttribute(verificationToken)
  return `<meta name="arohaa-verify" content="${tok}">`
}

export function resolveLandingSdkEnv(): {
  sdkScriptUrl: string
  ingestApiBase: string | null
} {
  const sdkScriptUrl =
    process.env.NEXT_PUBLIC_AROHAA_SDK_SCRIPT_URL?.trim() ||
    "https://cdn.arohaa.com/sdk.js"
  const ingestApiBase =
    process.env.NEXT_PUBLIC_AROHAA_INGEST_API_BASE?.trim() ||
    process.env.INGEST_BASE_URL?.trim() ||
    null

  return { sdkScriptUrl, ingestApiBase }
}
