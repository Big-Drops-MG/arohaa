import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type {
  FunnelDropOffRow,
  FunnelFieldDropOff,
  FunnelStep,
} from "@/features/funnel/model/funnel"
import { FunnelDropOffByFieldCard } from "@/features/funnel/view/FunnelDropOffByFieldCard"
import { FunnelMultiStepTrackingCard } from "@/features/funnel/view/FunnelMultiStepTrackingCard"

type FunnelDetailCardsProps = {
  formType: OverviewLandingFormType
  hasRedirect?: boolean
  multiStepSteps: FunnelStep[]
  dropOffRows: FunnelDropOffRow[]
}

function dropOffRowsToFields(rows: FunnelDropOffRow[]): FunnelFieldDropOff[] {
  return rows.map((row) => ({
    fieldName: row.fieldName,
    dropOffs: row.dropOffs,
    dropPercent: row.percentDrop,
  }))
}

export function FunnelDetailCards({
  formType,
  hasRedirect = false,
  multiStepSteps,
  dropOffRows,
}: FunnelDetailCardsProps) {
  if (formType === "none") return null

  const showMultiStep =
    formType === "multiple" || (formType === "zip" && multiStepSteps.length > 0)
  const showDropOff =
    formType === "single" ||
    formType === "multiple" ||
    (formType === "zip" && hasRedirect)

  if (!showMultiStep && !showDropOff) return null

  const dropOffFields = dropOffRowsToFields(dropOffRows)

  return (
    <div
      className={
        showMultiStep && showDropOff
          ? "grid gap-4 lg:grid-cols-2 lg:items-stretch lg:*:min-h-0"
          : "grid grid-cols-1 gap-4"
      }
    >
      {showMultiStep ? (
        <FunnelMultiStepTrackingCard steps={multiStepSteps} />
      ) : null}
      {showDropOff ? <FunnelDropOffByFieldCard fields={dropOffFields} /> : null}
    </div>
  )
}
