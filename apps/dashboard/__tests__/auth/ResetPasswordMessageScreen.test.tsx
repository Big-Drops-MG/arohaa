import { render, screen } from "@testing-library/react"

import { ResetPasswordMessageScreen } from "@/features/view/auth/ResetPasswordMessageScreen"

describe("ResetPasswordMessageScreen", () => {
  it("renders success copy and a link to login", () => {
    render(<ResetPasswordMessageScreen />)
    expect(screen.getByText("Password updated")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Back to sign in" })
    expect(link).toHaveAttribute("href", "/login")
  })
})
