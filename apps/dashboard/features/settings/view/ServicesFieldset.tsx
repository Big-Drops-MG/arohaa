"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import type { LandingPageService } from "@/features/settings/model/landing-page-services"

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
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">
        Services / verticals
      </legend>
      <p className="text-xs text-muted-foreground">
        Hub pages track clicks into these services instead of form submits. Mark
        links on the page with{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
          data-arohaa-service=&quot;id&quot;
        </code>{" "}
        matching each service id, or set a URL so the SDK can match hrefs.
      </p>

      <div className="space-y-3">
        {services.map((service, index) => (
          <div
            key={service.id}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`service-label-${service.id}`}>Label</Label>
                  <Input
                    id={`service-label-${service.id}`}
                    value={service.label}
                    onChange={(e) => updateAt(index, { label: e.target.value })}
                    placeholder="Auto Insurance"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`service-id-${service.id}`}>Service id</Label>
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
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-7 shrink-0"
                onClick={() => removeAt(index)}
                aria-label={`Remove ${service.label || "service"}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`service-target-${service.id}`}>
                  Linked landing page
                </Label>
                <select
                  id={`service-target-${service.id}`}
                  value={service.targetPublicId ?? ""}
                  onChange={(e) => linkCandidate(index, e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.publicId} value={candidate.publicId}>
                      {candidate.brandName}
                    </option>
                  ))}
                </select>
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
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addEmpty}
        disabled={disabled}
      >
        <Plus className="mr-1.5 size-4" />
        Add service
      </Button>
    </fieldset>
  )
}
