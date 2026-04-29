import { build } from "esbuild"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync("package.json", "utf-8"))
const version = pkg.version ?? "0.0.0"
const major = version.split(".")[0]

async function run() {
  await build({
    entryPoints: ["src/sdk.ts"],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: "iife",
    target: ["es2020"],
    outfile: `dist/sdk.v${major}.js`,
    define: {
      "process.env.SDK_VERSION": JSON.stringify(version),
    },
  })

  await build({
    entryPoints: ["src/sdk.ts"],
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

  await build({
    entryPoints: ["src/snippet.ts"],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: "iife",
    target: ["es2017"],
    outfile: "dist/snippet.js",
  })

  console.log(
    `Built sdk.js + sdk.v${major}.js + snippet.js (v${version})`,
  )
}

run()
