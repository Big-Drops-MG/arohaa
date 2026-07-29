import { SegmentBuilder } from "@/features/segments/view/segment-builder"

export default function SegmentsPage({
  params,
}: {
  params: { project: string }
}) {
  // Pass the workspace (project) ID to the SegmentBuilder
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

      <div className="mt-8">
        <SegmentBuilder workspaceId={params.project} />
      </div>
    </div>
  )
}
