import { render, screen } from "@testing-library/react"

import { AuthBrandHeader, AuthScreen } from "@/features/auth/view/AuthScreen"

describe("AuthScreen", () => {
  it("renders children inside the shell", () => {
    render(
      <AuthScreen>
        <p>Child content</p>
      </AuthScreen>
    )
    expect(screen.getByText("Child content")).toBeInTheDocument()
  })
})

describe("AuthBrandHeader", () => {
  it("renders title and optional description", () => {
    render(
      <AuthBrandHeader
        title="Test title"
        description="Test description body."
      />
    )
    expect(screen.getByText("Test title")).toBeInTheDocument()
    expect(screen.getByText("Test description body.")).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: "Company logo" })
    ).toBeInTheDocument()
  })

  it("renders title only when description is omitted", () => {
    render(<AuthBrandHeader title="Sign in" />)
    expect(screen.getByText("Sign in")).toBeInTheDocument()
    expect(
      screen.queryByText("We will email you a link to reset your password.")
    ).not.toBeInTheDocument()
  })
})
