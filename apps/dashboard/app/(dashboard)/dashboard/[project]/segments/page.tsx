import { SegmentBuilder } from "@/features/segments/view/segment-builder"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { notFound, redirect } from "next/navigation"

type SegmentsPageProps = {
  params: Promise<{ project: string }>
}

export default async function SegmentsPage({ params }: SegmentsPageProps) {
  const { project } = await params
  const actor = await requireLandingPageActor()
  if (!actor) notFound()
  const landingPage = await getActiveLandingPageForActor(actor.id, project)
  if (!landingPage) notFound()
  if (project !== landingPage.slug) {
    redirect(`/dashboard/${encodeURIComponent(landingPage.slug)}/segments`)
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Segments
        </h1>
        <p className="text-lg text-neutral-500">
          Manage dynamic user segments for your project.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
        <SegmentBuilder projectId={landingPage.publicId} />
      </div>
    </div>
  )
}
