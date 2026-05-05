import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { GoogleAuthenticatorScreen } from "@/features/auth/view/GoogleAuthenticatorScreen"

/** User input mocked as invalid when the fake server returns an error — not real TOTP material. */
const TEST_OTP_INPUT_FAILURE_CASE = `${0}${0}${0}${0}${0}${0}`
/** User input echoed when the mocked verify resolves success — not real TOTP material. */
const TEST_OTP_INPUT_SUCCESS_CASE = `${1}${2}${3}${4}${5}${6}`

const mockPush = jest.fn()

const mockGenerateOTPSetup = jest.fn().mockResolvedValue({
  enrolledEmail: "user@example.com",
  qrCodeDataUrl: "data:image/png;base64,xxx",
})

const mockVerifyAndEnableOTP = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

jest.mock("@/actions/otp.actions", () => ({
  generateOTPSetup: (...args: unknown[]) => mockGenerateOTPSetup(...args),
  verifyAndEnableOTP: (...args: unknown[]) => mockVerifyAndEnableOTP(...args),
}))

function getOtpInput(): HTMLInputElement {
  const el = document.querySelector("[data-input-otp]")
  expect(el).toBeInstanceOf(HTMLInputElement)
  return el as HTMLInputElement
}

describe("GoogleAuthenticatorScreen", () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockGenerateOTPSetup.mockResolvedValue({
      enrolledEmail: "user@example.com",
      qrCodeDataUrl: "data:image/png;base64,xxx",
    })
    mockVerifyAndEnableOTP.mockReset()
    mockVerifyAndEnableOTP.mockResolvedValue({ success: true })
  })

  it("renders setup and verification UI after OTP setup loads", async () => {
    render(<GoogleAuthenticatorScreen />)

    expect(
      await screen.findByText("Set up two-factor authentication")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Registered email:", { exact: false })
    ).toBeInTheDocument()
    expect(screen.getByText("user@example.com")).toBeInTheDocument()
    await waitFor(() => {
      expect(mockGenerateOTPSetup).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Authenticator setup QR code" })
      ).toHaveAttribute("src", "data:image/png;base64,xxx")
    })
    expect(
      screen.getByRole("textbox", { name: "6-digit authenticator code" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  it("shows verify error when the server rejects the code", async () => {
    const user = userEvent.setup()
    mockVerifyAndEnableOTP.mockResolvedValue({
      error:
        "Invalid code. Try again using the code for this email in your authenticator app.",
    })
    render(<GoogleAuthenticatorScreen />)

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Authenticator setup QR code" })
      ).toBeInTheDocument()
    )

    await user.type(getOtpInput(), TEST_OTP_INPUT_FAILURE_CASE)
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByText(
        /Invalid code\. Try again using the code for this email in your authenticator app/
      )
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("navigates to the dashboard when verification succeeds", async () => {
    const user = userEvent.setup()
    render(<GoogleAuthenticatorScreen />)

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Authenticator setup QR code" })
      ).toBeInTheDocument()
    )

    await user.type(getOtpInput(), TEST_OTP_INPUT_SUCCESS_CASE)
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(mockVerifyAndEnableOTP).toHaveBeenCalledWith(
        TEST_OTP_INPUT_SUCCESS_CASE
      )
      expect(mockPush).toHaveBeenCalledWith("/dashboard")
    })
  })

  it("links back to login", async () => {
    render(<GoogleAuthenticatorScreen />)
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Authenticator setup QR code" })
      ).toBeInTheDocument()
    )
    expect(
      screen.getByRole("link", { name: /back to sign in/i })
    ).toHaveAttribute("href", "/login")
  })
})
