import { render, screen } from "@testing-library/react"

import Page from "@/app/page"

describe("Page", () => {
  it("renders the dashboard title", () => {
    render(<Page />)
    expect(
      screen.getByRole("heading", { name: "Dashboard" })
    ).toBeInTheDocument()
  })
})
