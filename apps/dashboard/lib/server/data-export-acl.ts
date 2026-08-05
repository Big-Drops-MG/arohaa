const DATA_EXPORT_ALLOWLIST = new Set([
  "yash@bigdropsmarketing.com",
  "sami@bigdropsmarketing.com",
  "ishan@bigdropsmarketing.com",
])

export function canAccessDataExport(email: string | null | undefined): boolean {
  if (!email) return false
  return DATA_EXPORT_ALLOWLIST.has(email.trim().toLowerCase())
}

export function dataExportAllowlist(): readonly string[] {
  return [...DATA_EXPORT_ALLOWLIST]
}
