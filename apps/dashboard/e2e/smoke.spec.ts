import { expect, test } from "@playwright/test"

test.describe("public smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).toBeVisible()
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
