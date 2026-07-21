import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function readPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, '../../package.json')
    const raw = readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(raw) as { version?: string }
    const version = pkg.version?.trim()
    return version && version.length > 0 ? version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function shortSha(raw: string | undefined): string {
  const sha = raw?.trim() ?? ''
  if (!sha) return ''
  return sha.length > 7 ? sha.slice(0, 7) : sha
}

/**
 * Semver from package.json (or API_VERSION override), optionally with
 * build metadata from GIT_SHA so Ops can tell which image is running.
 *
 * Examples: `1.2.3`, `1.2.3+a1b2c3d`
 */
export function resolveApiVersion(): string {
  const explicit = process.env.API_VERSION?.trim()
  const base = explicit && explicit.length > 0 ? explicit : readPackageVersion()
  const sha = shortSha(
    process.env.GIT_SHA || process.env.SOURCE_VERSION || process.env.GITHUB_SHA,
  )
  if (!sha) return base
  if (base.includes('+') || base.includes(sha)) return base
  return `${base}+${sha}`
}
