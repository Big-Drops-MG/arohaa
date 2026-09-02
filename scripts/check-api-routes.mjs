import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiRoot = path.join(__dirname, "../apps/dashboard/app/api")
const frozenPath = path.join(__dirname, "check-api-routes.exempt.json")

const PERMANENT_EXEMPT = ["auth/[...nextauth]/route.ts"]

const EXEMPT = [...PERMANENT_EXEMPT]

function listRouteFiles(dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(abs, rel))
    } else if (entry.name === "route.ts") {
      files.push(rel.replace(/\\/g, "/"))
    }
  }
  return files
}

function loadFrozenExempt() {
  if (!fs.existsSync(frozenPath)) {
    console.error(
      `Missing frozen exempt snapshot at ${path.relative(process.cwd(), frozenPath)}`
    )
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(frozenPath, "utf8"))
  if (!Array.isArray(raw)) {
    console.error("Frozen exempt snapshot must be a JSON array of route paths.")
    process.exit(1)
  }
  return raw.map((entry) => String(entry).replace(/\\/g, "/"))
}

const frozen = new Set(loadFrozenExempt())
const exempt = new Set(EXEMPT.map((entry) => entry.replace(/\\/g, "/")))
const permanent = new Set(
  PERMANENT_EXEMPT.map((entry) => entry.replace(/\\/g, "/"))
)

const addedToExempt = [...exempt].filter((entry) => !frozen.has(entry)).sort()
if (addedToExempt.length > 0) {
  console.error(
    "EXEMPT may only shrink. These entries were added (convert with route() instead):\n"
  )
  for (const file of addedToExempt) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}

const routeFiles = listRouteFiles(apiRoot)
const missing = []
const staleExempt = []

for (const rel of exempt) {
  if (!routeFiles.includes(rel)) {
    staleExempt.push(rel)
  }
}

for (const rel of routeFiles) {
  if (exempt.has(rel)) continue
  const content = fs.readFileSync(path.join(apiRoot, rel), "utf8")
  if (!content.includes("@/lib/server/route")) {
    missing.push(rel)
  }
}

if (staleExempt.length > 0) {
  console.error(
    "EXEMPT entries no longer exist on disk (remove them from EXEMPT and the frozen snapshot if intentional):\n"
  )
  for (const file of staleExempt.sort()) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}

if (missing.length > 0) {
  console.error(
    "API routes must use route() from @/lib/server/route (or be on the frozen EXEMPT list):\n"
  )
  for (const file of missing.sort()) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}

const shrinkableExempt = [...exempt].filter((entry) => !permanent.has(entry))
const converted = frozen.size - exempt.size
console.log(
  `API route guard OK: ${routeFiles.length - exempt.size} use route(); ${exempt.size} exempt (${permanent.size} permanent); ${shrinkableExempt.length} shrinkable; ${converted} converted since freeze.`
)
