import { NewLandingPage } from "@/features/dashboard/view/NewLandingPage"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Add Landing Page")

export default function NewLandingRoute() {
  return <NewLandingPage />
}
