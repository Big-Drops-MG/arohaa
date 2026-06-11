"use client"

import { useCallback, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type SettingsCopyBlockProps = {
  label: string
  value: string
  description?: string
  copyLabel?: string
  className?: string
}

export function SettingsCopyBlock({
  label,
  value,
  description,
  copyLabel = "Copy",
  className,
}: SettingsCopyBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!value.trim()) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [value])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => void handleCopy()}
          disabled={!value.trim()}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? "Copied" : copyLabel}
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <code className="block text-sm break-all whitespace-pre-wrap text-foreground">
          {value || "—"}
        </code>
      </div>
    </div>
  )
}
