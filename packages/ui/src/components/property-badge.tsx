import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

const MAX_RENDERED_LENGTH = 256

function safeStringify(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"

  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (typeof value === "bigint") return `${value.toString()}n`

  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return "[Unserializable]"
    }
  }

  return String(value)
}

function PropertyBadge({
  value,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  value: unknown
  label?: string
}) {
  const stringified = safeStringify(value)
  const display =
    stringified.length > MAX_RENDERED_LENGTH
      ? `${stringified.slice(0, MAX_RENDERED_LENGTH)}…`
      : stringified

  return (
    <span
      data-slot="property-badge"
      title={label ? `${label}: ${stringified}` : stringified}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground/80",
        className
      )}
      {...props}
    >
      {label ? <span className="text-muted-foreground">{label}:</span> : null}
      <span className="truncate">{display}</span>
    </span>
  )
}

export { PropertyBadge }
