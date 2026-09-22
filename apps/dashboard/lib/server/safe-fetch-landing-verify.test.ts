import { describe, expect, it } from "vitest"
import {
  isUnsafeIp,
  landingHtmlIncludesVerificationToken,
} from "./safe-fetch-landing-verify"

describe("isUnsafeIp", () => {
  it("blocks private and loopback IPv4", () => {
    expect(isUnsafeIp("127.0.0.1")).toBe(true)
    expect(isUnsafeIp("10.0.0.1")).toBe(true)
    expect(isUnsafeIp("192.168.1.1")).toBe(true)
    expect(isUnsafeIp("172.16.5.1")).toBe(true)
    expect(isUnsafeIp("169.254.1.1")).toBe(true)
    expect(isUnsafeIp("100.64.1.1")).toBe(true)
  })

  it("blocks IPv4-mapped IPv6 loopback and private", () => {
    expect(isUnsafeIp("::ffff:127.0.0.1")).toBe(true)
    expect(isUnsafeIp("::ffff:10.1.2.3")).toBe(true)
    expect(isUnsafeIp("::ffff:7f00:1")).toBe(true)
  })

  it("allows public IPv4 and IPv6", () => {
    expect(isUnsafeIp("8.8.8.8")).toBe(false)
    expect(isUnsafeIp("2001:4860:4860::8888")).toBe(false)
  })
})

describe("landingHtmlIncludesVerificationToken", () => {
  const token = "abc_VerifyToken-123"

  it("accepts a proper meta tag", () => {
    const html = `<html><head><meta name="arohaa-verify" content="${token}"></head></html>`
    expect(landingHtmlIncludesVerificationToken(html, token)).toBe(true)
  })

  it("accepts reversed attribute order and single quotes", () => {
    const html = `<meta content='${token}' name='arohaa-verify' />`
    expect(landingHtmlIncludesVerificationToken(html, token)).toBe(true)
  })

  it("rejects token only present as a substring outside a meta tag", () => {
    const html = `<html><!-- ${token} --><script>var t="${token}"</script></html>`
    expect(landingHtmlIncludesVerificationToken(html, token)).toBe(false)
  })

  it("rejects wrong meta name or content", () => {
    expect(
      landingHtmlIncludesVerificationToken(
        `<meta name="arohaa-verify" content="other">`,
        token
      )
    ).toBe(false)
    expect(
      landingHtmlIncludesVerificationToken(
        `<meta name="description" content="${token}">`,
        token
      )
    ).toBe(false)
  })
})
