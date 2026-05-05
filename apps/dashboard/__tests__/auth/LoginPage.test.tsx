import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LoginPage } from "@/features/auth/view/LoginPage"

const mockLoginWithCredentials = jest.fn()

type NextNavigationRouterMocks = {
  push: jest.Mock
  refresh: jest.Mock
  replace: jest.Mock
  prefetch: jest.Mock
  back: jest.Mock
}

const STABLE_NAV_ROUTER_KEY = "__LOGIN_PAGE_NAV_ROUTER__" as const

function stableNavigationRouterMocks(): NextNavigationRouterMocks {
  const g = globalThis as unknown as Record<
    string,
    NextNavigationRouterMocks | undefined
  >
  if (!g[STABLE_NAV_ROUTER_KEY]) {
    g[STABLE_NAV_ROUTER_KEY] = {
      push: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
  }
  return g[STABLE_NAV_ROUTER_KEY]
}

jest.mock("@/actions/auth.actions", () => ({
  loginWithCredentials: (...args: unknown[]) =>
    mockLoginWithCredentials(...args),
}))

jest.mock("next/navigation", () => ({
  useRouter: () => stableNavigationRouterMocks(),
  useSearchParams: () => new URLSearchParams(),
}))

function getOtpInput(): HTMLInputElement {
  const el = screen.getByRole("textbox", { name: "6-digit authenticator code" })
  expect(el).toBeInstanceOf(HTMLInputElement)
  return el as HTMLInputElement
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockLoginWithCredentials.mockReset()
    mockLoginWithCredentials.mockResolvedValue(undefined)
    stableNavigationRouterMocks().push.mockClear()
    stableNavigationRouterMocks().refresh.mockClear()
  })

  it("renders the login form", () => {
    render(<LoginPage />)
    expect(screen.getByText("Sign in to Dashboard")).toBeInTheDocument()
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

  it("advances to the OTP step when the server requests two-factor", async () => {
    mockLoginWithCredentials.mockResolvedValue({ requiresTwoFactor: true })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "password12")
    await user.click(screen.getByRole("button", { name: /Continue/i }))

    await waitFor(() => {
      expect(screen.getByText("Verify your identity")).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Open your authenticator app and enter the current code/)
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(mockLoginWithCredentials).toHaveBeenCalledTimes(1)
    })
    const fd = mockLoginWithCredentials.mock.calls[0][0] as FormData
    expect(fd.get("email")).toBe("user@example.com")
    expect(fd.get("password")).toBe("password12")
    expect(fd.get("code")).toBeNull()
  })

  it("shows back navigation from the OTP step", async () => {
    mockLoginWithCredentials.mockResolvedValue({ requiresTwoFactor: true })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "password12")
    await user.click(screen.getByRole("button", { name: /Continue/i }))

    await screen.findByText("Verify your identity")

    await user.click(screen.getByRole("button", { name: /Back to sign in/i }))

    expect(screen.getByText("Sign in to Dashboard")).toBeInTheDocument()
  })

  it("navigates to the dashboard after a successful OTP login", async () => {
    mockLoginWithCredentials
      .mockResolvedValueOnce({ requiresTwoFactor: true })
      .mockResolvedValueOnce({ redirectTo: "/dashboard" })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "password12")
    await user.click(screen.getByRole("button", { name: /Continue/i }))

    await screen.findByText("Verify your identity")

    await user.type(getOtpInput(), "123456")

    await waitFor(() => {
      expect(mockLoginWithCredentials).toHaveBeenCalledTimes(2)
      expect(stableNavigationRouterMocks().push).toHaveBeenCalledWith(
        "/dashboard"
      )
      expect(stableNavigationRouterMocks().refresh).toHaveBeenCalled()
    })
  })
})
