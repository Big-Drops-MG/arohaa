"use client"

import { useState, type ReactNode } from "react"
import { Maximize2 } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { overviewSectionHeadingClassName } from "@/features/overview/view/overview-card-density"

type TrafficExpandableCardProps = {
  title: string
  children: ReactNode
  expandedContent?: ReactNode
  className?: string
  dialogClassName?: string
}

export function TrafficExpandableCard({
  title,
  children,
  expandedContent,
  className,
  dialogClassName,
}: TrafficExpandableCardProps) {
  const [open, setOpen] = useState(false)
  const dialogBody = expandedContent ?? children

  return (
    <>
      <div className={cn("group/card relative max-w-none", className)}>
        {children}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-3 opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={`Expand ${title}`}
          >
            <Maximize2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "max-h-[min(85vh,900px)] max-w-3xl gap-0 overflow-hidden p-0",
            dialogClassName
          )}
        >
          <DialogHeader className="border-b border-border px-6 py-4 pr-12">
            <DialogTitle className={overviewSectionHeadingClassName}>
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(calc(85vh-4.5rem),820px)] overflow-y-auto">
            {dialogBody}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
