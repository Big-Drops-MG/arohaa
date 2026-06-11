import { HomePage } from "@/features/dashboard/HomePage"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Landing Pages")

export default function HomepagePage() {
  return <HomePage />
}
