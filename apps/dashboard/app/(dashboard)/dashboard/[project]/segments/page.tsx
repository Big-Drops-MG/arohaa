import { SegmentBuilder } from "@/features/segments/view/segment-builder"

type SegmentsPageProps = {
  params: Promise<{ project: string }>
}

export default async function SegmentsPage({ params }: SegmentsPageProps) {
  const { project } = await params

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
        <SegmentBuilder projectId={project} />
      </div>
    </div>
  )
}
