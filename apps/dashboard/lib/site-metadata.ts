import type { Metadata } from "next"

export const siteName = "Arohaa"

export const rootMetadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description:
    "Monitor landing page performance, funnels, and conversions across your projects.",
}

export function pageMetadata(title: string, description?: string): Metadata {
  return description ? { title, description } : { title }
}
