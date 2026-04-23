import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ForgotPassword } from "@/features/view/auth/ForgotPassword"

const mockPush = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

describe("ForgotPassword", () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it("renders the forgot password form", () => {
    render(<ForgotPassword />)
    expect(screen.getByText("Forgot password")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Send reset link" })
    ).toBeDisabled()
  })

  it("shows an error when submit is attempted with an invalid email", async () => {
    const user = userEvent.setup()
    render(<ForgotPassword />)
    await user.type(screen.getByLabelText("Email"), "bad")
    await user.click(screen.getByRole("button", { name: "Send reset link" }))

    expect(
      await screen.findByText("Enter a valid email address.")
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("navigates to the sent screen with a valid email", async () => {
    const user = userEvent.setup()
    render(<ForgotPassword />)
    await user.type(screen.getByLabelText("Email"), "valid@example.com")
    await user.click(screen.getByRole("button", { name: "Send reset link" }))

    expect(mockPush).toHaveBeenCalledWith("/forgot-password/sent")
  })

  it("links back to login", () => {
    render(<ForgotPassword />)
    expect(
      screen.getByRole("link", { name: /back to sign in/i })
    ).toHaveAttribute("href", "/login")
  })
})
