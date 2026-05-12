import { getLandingPageList } from "@/features/dashboard/controller/landing-pages"
import { LandingPagesDashboard } from "@/features/dashboard/view/LandingPagesDashboard"

export async function HomePage() {
  const pages = await getLandingPageList()

  return <LandingPagesDashboard pages={pages} />
}
