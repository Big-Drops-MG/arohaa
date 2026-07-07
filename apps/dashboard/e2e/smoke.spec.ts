import { expect, test } from "@playwright/test"

test.describe("public smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test("unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("profile page requires authentication", async ({ page }) => {
    await page.goto("/dashboard/profile")
    await expect(page).toHaveURL(/\/login/)
  })
})
