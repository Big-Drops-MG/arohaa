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
    title: "New Landing Page",
  },
  {
    mode: "variant",
    icon: FlaskConical,
    title: "New Variant",
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
      <PopoverContent
        align="end"
        className="w-56 gap-0.5 border border-neutral-200 bg-white p-1.5 text-neutral-900 shadow-lg ring-1 ring-black/5"
      >
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
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-neutral-900 transition-colors outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100"
            >
              <Icon className="size-4 shrink-0 text-neutral-500" aria-hidden />
              {option.title}
            </Link>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
