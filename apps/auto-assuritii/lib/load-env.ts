import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const candidates = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env.local"),
  resolve(process.cwd(), "../../.env"),
]

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: false })
  }
}
