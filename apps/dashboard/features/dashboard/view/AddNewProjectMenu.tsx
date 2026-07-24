"use client"

import Link from "next/link"
import { useState } from "react"
import { FlaskConical, LayoutTemplate, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import {
  NEW_LANDING_PATH,
  newVariantPath,
} from "@/features/dashboard/model/new-landing-mode"

type AddNewProjectMenuProps = {
  size?: "default" | "lg"
  label?: string
  className?: string
  /** Preselects a parent project in the variant wizard. */
  parentPublicId?: string
}

const OPTIONS = [
  {
    mode: "landing",
    icon: LayoutTemplate,
    title: "Add New Landing Page",
    description: "Track a standalone page with its own SDK snippet.",
  },
  {
    mode: "variant",
    icon: FlaskConical,
    title: "Add New Variant",
    description: "Compare a new page against a project already on Arohaa.",
  },
] as const

export function AddNewProjectMenu({
  size = "default",
  label = "Add New",
  className,
  parentPublicId,
}: AddNewProjectMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size={size}
          className={cn("gap-2", className)}
          aria-label={label}
        >
          <Plus className={size === "lg" ? "size-5" : "size-4"} aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-1 p-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon
          const href =
            option.mode === "variant"
              ? newVariantPath(parentPublicId)
              : NEW_LANDING_PATH

          return (
            <Link
              key={option.title}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {option.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </Link>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
