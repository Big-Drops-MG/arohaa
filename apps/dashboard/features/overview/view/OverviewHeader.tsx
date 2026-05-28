import { cn } from "@workspace/ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"

type OverviewHeaderProps = {
  title: string
  dateRangeOptions: OverviewDateRangeOption[]
  dateRangeId: OverviewDateRangeId
  onDateRangeChange: (id: OverviewDateRangeId) => void
}

export function OverviewHeader({
  title,
  dateRangeOptions,
  dateRangeId,
  onDateRangeChange,
}: OverviewHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <Select
        value={dateRangeId}
        onValueChange={(v) => onDateRangeChange(v as OverviewDateRangeId)}
      >
        <SelectTrigger
          size="sm"
          className={cn(overviewSelectTriggerClassName, "w-full sm:w-40")}
          aria-label="Date range"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          align="end"
          position="popper"
          side="bottom"
          sideOffset={6}
          avoidCollisions={false}
          className={overviewSelectContentClassName}
        >
          {dateRangeOptions.map((opt) => (
            <SelectItem
              key={opt.id}
              value={opt.id}
              className={overviewSelectItemClassName}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
