import "@testing-library/jest-dom"
import * as React from "react"

jest.mock("next-auth/react", () => ({
  __esModule: true,
  signIn: jest.fn().mockResolvedValue({ ok: true, error: null }),
}))

if (
  typeof document !== "undefined" &&
  typeof document.elementFromPoint !== "function"
) {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => null,
  })
}

globalThis.ResizeObserver = class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

jest.mock("next/image", () => ({
  __esModule: true,
  default({
    alt,
    src,
    width,
    height,
    className,
  }: {
    alt?: string
    src?: string
    width?: number
    height?: number
    className?: string
  }) {
    return React.createElement("img", {
      alt: alt ?? "",
      src,
      width,
      height,
      className,
    })
  },
}))
