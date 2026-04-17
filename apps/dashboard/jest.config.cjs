const nextJest = require("next/jest")

const createJestConfig = nextJest({ dir: __dirname })

/** @type {import("jest").Config} */
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@workspace/ui/(.*)$": "<rootDir>/../../packages/ui/src/$1",
  },
}

module.exports = createJestConfig(customJestConfig)
