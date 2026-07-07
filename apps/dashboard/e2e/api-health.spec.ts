import { expect, test } from "@playwright/test"

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? "https://api.arohaa.net"

test.describe("API health", () => {
  test("GET /health returns ok", async ({ request }) => {
    const response = await request.get(`${apiBase}/health`)
    expect(response.ok()).toBeTruthy()
    const json = (await response.json()) as { status: string }
    expect(json.status).toBe("ok")
  })

  test("GET /health/ready reports dependencies", async ({ request }) => {
    const response = await request.get(`${apiBase}/health/ready`)
    expect([200, 503]).toContain(response.status())
    const json = (await response.json()) as {
      status: string
      dependencies?: Record<string, string>
    }
    expect(json.status).toBeTruthy()
    if (response.ok()) {
      expect(json.dependencies?.clickhouse).toBe("ok")
      expect(json.dependencies?.redis).toBe("ok")
    }
  })
})
