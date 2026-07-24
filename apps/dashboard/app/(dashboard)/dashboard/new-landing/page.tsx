import { parseNewLandingMode } from "@/features/dashboard/model/new-landing-mode"
import { NewLandingPage } from "@/features/dashboard/view/NewLandingPage"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Add Landing Page")

type NewLandingRouteProps = {
  searchParams: Promise<{ mode?: string; parent?: string }>
}

export default async function NewLandingRoute({
  searchParams,
}: NewLandingRouteProps) {
  const { mode, parent } = await searchParams

  return (
    <NewLandingPage
      mode={parseNewLandingMode(mode)}
      initialParentPublicId={parent?.trim() || null}
    />
  )
}
