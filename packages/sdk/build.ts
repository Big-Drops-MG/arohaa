import { readFileSync } from "node:fs"
import { rollup } from "rollup"
import terser from "@rollup/plugin-terser"
import esbuild from "rollup-plugin-esbuild"

const pkg = JSON.parse(readFileSync("package.json", "utf-8"))
const version = pkg.version ?? "0.0.0"
const major = version.split(".")[0]

async function buildBundle(options: {
  input: string
  output: string
  target: string
  sourcemap: boolean
  define?: Record<string, string>
}) {
  const bundle = await rollup({
    input: options.input,
    plugins: [
      esbuild({
        target: options.target,
        define: options.define,
        minify: false,
      }),
      terser(),
    ],
  })

  await bundle.write({
    file: options.output,
    format: "iife",
    sourcemap: options.sourcemap,
  })
  await bundle.close()
}

async function run() {
  const sdkDefine = {
    "process.env.SDK_VERSION": JSON.stringify(version),
  }

  await buildBundle({
    input: "src/sdk.ts",
    output: `dist/sdk.v${major}.js`,
    target: "es2020",
    sourcemap: true,
    define: sdkDefine,
  })

  await buildBundle({
    input: "src/sdk.ts",
    output: "dist/sdk.js",
    target: "es2020",
    sourcemap: true,
    define: sdkDefine,
  })

  await buildBundle({
    input: "src/snippet.ts",
    output: "dist/snippet.js",
    target: "es2017",
    sourcemap: false,
  })

  console.log(`Built sdk.js + sdk.v${major}.js + snippet.js (v${version}) via Rollup`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
