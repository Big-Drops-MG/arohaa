import { nextJsConfig } from "@workspace/eslint-config/next-js"
import globals from "globals"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    ignores: ["jest.config.cjs"],
  },
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "**/jest.setup.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
]
