import { build } from "esbuild"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync("package.json", "utf-8"))
const version = pkg.version ?? "0.0.0"

async function run() {
  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: "iife",
    target: ["es2020"],
    outfile: `dist/sdk.v${version.split(".")[0]}.js`,
    define: {
      "process.env.SDK_VERSION": JSON.stringify(version),
    },
  })

  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: "iife",
    target: ["es2020"],
    outfile: "dist/sdk.js",
    define: {
      "process.env.SDK_VERSION": JSON.stringify(version),
    },
  })

  console.log(`Built sdk.js + sdk.v${version.split(".")[0]}.js (v${version})`)
}

run()
