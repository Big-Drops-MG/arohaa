import { redirect } from "next/navigation"

import Page from "@/app/page"

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

describe("Page", () => {
  it("redirects to /login", async () => {
    await Page()
    expect(redirect).toHaveBeenCalledWith("/login")
  })
})
