import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { GoogleAuthenticatorScreen } from "@/features/view/auth/GoogleAuthenticatorScreen"

const mockPush = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

function getOtpInput(): HTMLInputElement {
  const el = document.querySelector("[data-input-otp]")
  expect(el).toBeInstanceOf(HTMLInputElement)
  return el as HTMLInputElement
}

describe("GoogleAuthenticatorScreen", () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it("renders the verification form", () => {
    render(<GoogleAuthenticatorScreen />)
    expect(screen.getByText("Verify your identity")).toBeInTheDocument()
    expect(
      screen.getByText("Enter the 6-digit code from your authenticator app.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "6-digit authenticator code" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  it("shows an error when the code is complete but incorrect", async () => {
    const user = userEvent.setup()
    render(<GoogleAuthenticatorScreen />)

    await user.type(getOtpInput(), "000000")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByText("That code did not match. Please try again.")
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("navigates to the dashboard when the test code is correct", async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<GoogleAuthenticatorScreen />)

    await user.type(getOtpInput(), "456789")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    act(() => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard")
    })

    jest.useRealTimers()
  })

  it("links back to login", () => {
    render(<GoogleAuthenticatorScreen />)
    expect(
      screen.getByRole("link", { name: /back to sign in/i })
    ).toHaveAttribute("href", "/login")
  })
})
