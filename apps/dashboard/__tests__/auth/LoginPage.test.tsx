import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LoginPage } from "@/features/view/auth/LoginPage"

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage />)
    expect(screen.getByText("Login using your credentials")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  it("disables continue until both fields have values", async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    const email = screen.getByLabelText("Email")
    const password = screen.getByLabelText("Password")
    const submit = screen.getByRole("button", { name: "Continue" })

    await user.type(email, "a@b.co")
    expect(submit).toBeDisabled()

    await user.type(password, "secret12")
    expect(submit).not.toBeDisabled()
  })

  it("shows validation errors for invalid credentials after submit", async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText("Email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "short")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByText("Enter a valid email address.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Password must be at least 8 characters.")
    ).toBeInTheDocument()
  })

  it("toggles password visibility", async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    const password = screen.getByLabelText("Password") as HTMLInputElement
    expect(password.type).toBe("password")

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(password.type).toBe("text")

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(password.type).toBe("password")
  })

  it("advances to the OTP step after a valid submit", async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<LoginPage />)

    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "password12")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.getByText("Verify your identity")).toBeInTheDocument()
    })

    jest.useRealTimers()
  })
})
