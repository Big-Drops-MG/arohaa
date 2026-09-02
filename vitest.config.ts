import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)))

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: [path.resolve(repoRoot, "apps/dashboard/lib/server/test/vitest.setup.ts")],
  },
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "apps/dashboard"),
      "server-only": path.resolve(
        repoRoot,
        "apps/dashboard/lib/server/test/server-only-stub.ts"
      ),
    },
  },
})
