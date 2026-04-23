import { render, screen } from "@testing-library/react"

import { ForgotPasswordMessageScreen } from "@/features/view/auth/ForgotPasswordMessageScreen"

describe("ForgotPasswordMessageScreen", () => {
  it("renders confirmation copy and a link to login", () => {
    render(<ForgotPasswordMessageScreen />)
    expect(screen.getByText("Check your email")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Back to sign in" })
    expect(link).toHaveAttribute("href", "/login")
  })
})
