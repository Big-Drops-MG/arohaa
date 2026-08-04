"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import type { LandingPageService } from "@/features/settings/model/landing-page-services"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"

type ServiceCandidate = {
  publicId: string
  brandName: string
  landingPageUrl: string
}

type ServicesFieldsetProps = {
  services: LandingPageService[]
  onChange: (services: LandingPageService[]) => void
  candidates: ServiceCandidate[]
  disabled?: boolean
}

const NONE_VALUE = "__none__"

function newServiceId(): string {
  return `svc-${Math.random().toString(36).slice(2, 10)}`
}

export function ServicesFieldset({
  services,
  onChange,
  candidates,
  disabled = false,
}: ServicesFieldsetProps) {
  const updateAt = (index: number, patch: Partial<LandingPageService>) => {
    onChange(
      services.map((service, i) =>
        i === index ? { ...service, ...patch } : service
      )
    )
  }

  const removeAt = (index: number) => {
    onChange(services.filter((_, i) => i !== index))
  }

  const addEmpty = () => {
    onChange([
      ...services,
      {
        id: newServiceId(),
        label: "",
        targetPublicId: null,
        href: null,
      },
    ])
  }

  const linkCandidate = (index: number, publicId: string) => {
    if (!publicId || publicId === NONE_VALUE) {
      updateAt(index, { targetPublicId: null })
      return
    }

    const candidate = candidates.find((c) => c.publicId === publicId)
    if (!candidate) {
      updateAt(index, { targetPublicId: null })
      return
    }

    updateAt(index, {
      targetPublicId: candidate.publicId,
      label: services[index]?.label?.trim() || candidate.brandName,
      href: candidate.landingPageUrl,
    })
  }

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <div className="space-y-1.5">
        <legend className="text-sm font-medium text-foreground">
          Services / verticals
        </legend>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Hub pages track clicks into these services instead of form submits.
          Mark links with{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            data-arohaa-service=&quot;id&quot;
          </code>{" "}
          or set a destination URL for href matching.
        </p>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No services yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add Auto Insurance, Home Insurance, or any vertical this hub routes
            users into.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmpty}
            disabled={disabled}
            className="mt-1"
          >
            <Plus className="mr-1.5 size-4" />
            Add service
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service, index) => {
            const title = service.label.trim() || `Service ${index + 1}`
            const selectValue = service.targetPublicId ?? NONE_VALUE

            return (
              <article
                key={service.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    Service {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeAt(index)}
                    disabled={disabled}
                    aria-label={`Remove ${title}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`service-label-${service.id}`}>Label</Label>
                    <Input
                      id={`service-label-${service.id}`}
                      value={service.label}
                      onChange={(e) =>
                        updateAt(index, { label: e.target.value })
                      }
                      placeholder="Auto Insurance"
                      className="h-10"
                      disabled={disabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`service-id-${service.id}`}>
                      Service id
                    </Label>
                    <Input
                      id={`service-id-${service.id}`}
                      value={service.id}
                      onChange={(e) =>
                        updateAt(index, {
                          id: e.target.value.trim() || service.id,
                        })
                      }
                      placeholder="auto-insurance"
                      className="h-10 font-mono text-xs"
                      disabled={disabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`service-target-${service.id}`}>
                      Linked landing page
                    </Label>
                    <Select
                      value={selectValue}
                      onValueChange={(value) => linkCandidate(index, value)}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        id={`service-target-${service.id}`}
                        aria-label="Linked landing page"
                        className={cn(
                          overviewSelectTriggerClassName,
                          "h-10 w-full"
                        )}
                      >
                        <SelectValue placeholder="Select a landing page" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        align="start"
                        className={cn(
                          overviewSelectContentClassName,
                          "w-(--radix-select-trigger-width)"
                        )}
                      >
                        <SelectItem
                          value={NONE_VALUE}
                          className={overviewSelectItemClassName}
                        >
                          None
                        </SelectItem>
                        {candidates.map((candidate) => (
                          <SelectItem
                            key={candidate.publicId}
                            value={candidate.publicId}
                            className={overviewSelectItemClassName}
                          >
                            {candidate.brandName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`service-href-${service.id}`}>
                      Destination URL
                    </Label>
                    <Input
                      id={`service-href-${service.id}`}
                      type="url"
                      value={service.href ?? ""}
                      onChange={(e) =>
                        updateAt(index, {
                          href: e.target.value.trim() || null,
                        })
                      }
                      placeholder="https://example.com/auto"
                      className="h-10"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </article>
            )
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmpty}
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-1.5 size-4" />
            Add service
          </Button>
        </div>
      )}
    </fieldset>
  )
}
