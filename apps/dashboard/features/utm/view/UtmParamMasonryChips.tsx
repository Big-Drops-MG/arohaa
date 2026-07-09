"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { UtmParamPair } from "@/features/utm/model/utm"

const PARAM_SECTIONS = [
  { key: "utm_source", label: "Source" },
  { key: "utm_s1", label: "S1" },
] as const

type UtmSectionFilter = "all" | "source" | "s1"

type UtmParamMasonryChipsProps = {
  items: UtmParamPair[]
  tone: "success" | "danger"
  emptyMessage: string
  sectionFilter?: UtmSectionFilter
}

function sectionsForFilter(filter: UtmSectionFilter = "all") {
  if (filter === "source") {
    return PARAM_SECTIONS.filter((section) => section.key === "utm_source")
  }
  if (filter === "s1") {
    return PARAM_SECTIONS.filter((section) => section.key === "utm_s1")
  }
  return PARAM_SECTIONS
}

function sortValues(items: UtmParamPair[]): UtmParamPair[] {
  return [...items].sort((a, b) =>
    a.value.localeCompare(b.value, undefined, { sensitivity: "base" })
  )
}

export function UtmParamMasonryChips({
  items,
  tone: _tone,
  emptyMessage,
  sectionFilter = "all",
}: UtmParamMasonryChipsProps) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  const chipClass = "border-border bg-muted/40 text-foreground"

  const sectionLabelClass = "text-muted-foreground"

  const visibleSections = sectionsForFilter(sectionFilter)

  return (
    <div className="space-y-6">
      {visibleSections.map((section) => {
        const sectionItems = sortValues(
          items.filter((item) => item.key === section.key)
        )

        return (
          <section key={section.key} className="space-y-3">
            <h4
              className={cn(
                "border-b border-border pb-2 text-xs font-semibold tracking-wide uppercase",
                sectionLabelClass
              )}
            >
              {section.label}
            </h4>

            {sectionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {section.label.toLowerCase()} values.
              </p>
            ) : (
              <div className="columns-2 gap-3 sm:columns-3">
                {sectionItems.map((item) => (
                  <div
                    key={`${item.key}:${item.value}`}
                    className={cn(
                      "mb-3 break-inside-avoid rounded-lg border px-4 py-3 text-sm leading-snug font-medium break-all",
                      chipClass
                    )}
                  >
                    {item.value}
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
