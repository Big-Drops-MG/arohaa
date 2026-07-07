import { generateSync } from "otplib"
import { expect, test } from "@playwright/test"

const email = process.env.E2E_EMAIL?.trim()
const password = process.env.E2E_PASSWORD?.trim()
const totpSecret = process.env.E2E_TOTP_SECRET?.trim()

test.describe("authenticated profile", () => {
  test.skip(
    !email || !password || !totpSecret,
    "Set E2E_EMAIL, E2E_PASSWORD, and E2E_TOTP_SECRET to run authenticated E2E"
  )

  test("profile shows API keys and alert webhooks sections", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill(email!)
    await page.getByLabel(/password/i).fill(password!)
    await page.getByRole("button", { name: /^sign in$/i }).click()

    await expect(
      page.getByText(/two-factor|authenticator|verification code/i)
    ).toBeVisible({
      timeout: 15_000,
    })

    const otp = generateSync({ secret: totpSecret! })
    await page.locator("#login-otp").fill(otp)
    await page.getByRole("button", { name: /verify|continue|sign in/i }).click()

    await page.goto("/dashboard/profile")
    await expect(
      page.getByRole("heading", { name: /^profile$/i })
    ).toBeVisible()
    await expect(page.getByText("API keys")).toBeVisible()
    await expect(page.getByText("Alert webhooks")).toBeVisible()
  })
})
