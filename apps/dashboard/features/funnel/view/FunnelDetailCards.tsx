import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import { FunnelDropOffByFieldCard } from "@/features/funnel/view/FunnelDropOffByFieldCard"
import { FunnelMultiStepTrackingCard } from "@/features/funnel/view/FunnelMultiStepTrackingCard"
import type {
  FunnelFieldDropOff,
  FunnelStep,
} from "@/features/funnel/model/funnel"

type FunnelDetailCardsProps = {
  formType: OverviewLandingFormType
  multiStepFormTracking: FunnelStep[]
  formDropOffByField: FunnelFieldDropOff[]
}

export function FunnelDetailCards({
  formType,
  multiStepFormTracking,
  formDropOffByField,
}: FunnelDetailCardsProps) {
  if (formType === "zip") return null

  const showMultiStep = formType === "multiple"
  const showDropOff = formType === "single" || formType === "multiple"

  if (!showMultiStep && !showDropOff) return null

  return (
    <div
      className={
        showMultiStep && showDropOff
          ? "grid gap-4 lg:grid-cols-2 lg:items-start"
          : "grid grid-cols-1 gap-4"
      }
    >
      {showMultiStep ? (
        <FunnelMultiStepTrackingCard steps={multiStepFormTracking} />
      ) : null}
      {showDropOff ? (
        <FunnelDropOffByFieldCard fields={formDropOffByField} />
      ) : null}
    </div>
  )
}
