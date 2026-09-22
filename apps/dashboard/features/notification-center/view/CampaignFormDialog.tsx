"use client"

import type { Dispatch, ReactNode, SetStateAction } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { WEB_PUSH_TRIGGER_EVENTS } from "@/features/notification-center/model/notification-center"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"

export type DripStepForm = {
  delayMinutes: string
  title: string
  body: string
  tag: string
}

export type CampaignFormState = {
  name: string
  title: string
  body: string
  iconUrl: string
  badgeUrl: string
  imageUrl: string
  tag: string
  requireInteraction: boolean
  clickMode: "fixed" | "template" | "last_url"
  fixedUrl: string
  urlTemplate: string
  appendUtmSource: string
  appendUtmMedium: string
  appendUtmCampaign: string
  maskedRedirect: boolean
  resumeMode: "frozen" | "fresh"
  triggerType: "delay_after_event" | "immediate" | "drip"
  triggerEvent: string
  delayMinutes: string
  dripSteps: DripStepForm[]
  cancelOn: string[]
  maxPerUserPerDay: string
  quietEnabled: boolean
  quietStart: string
  quietEnd: string
  quietTz: string
  status: "draft" | "active" | "paused"
}

const fieldInputClassName =
  "h-9 rounded-lg border-neutral-200 bg-white shadow-xs"

const fieldTextareaClassName =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1 border-b border-neutral-100 pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function OptionRow({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  title: string
  description: string
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-3 shadow-xs transition-colors",
        checked
          ? "border-neutral-300 bg-neutral-50/80"
          : "hover:bg-neutral-50/60",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-neutral-300"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block text-[11px] leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  )
}

type CampaignFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CampaignFormState
  setForm: Dispatch<SetStateAction<CampaignFormState>>
  editingId: string | null
  busy: boolean
  mediaUploadConfigured: boolean
  clickBaseUrl: string | null
  onUploadMedia: (kind: "icon" | "badge" | "image", file: File) => Promise<void>
  onSave: () => void
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editingId,
  busy,
  mediaUploadConfigured,
  clickBaseUrl,
  onUploadMedia,
  onSave,
}: CampaignFormDialogProps) {
  function MediaField({
    label,
    hint,
    kind,
    value,
    onChange,
  }: {
    label: string
    hint: string
    kind: "icon" | "badge" | "image"
    value: string
    onChange: (next: string) => void
  }) {
    return (
      <Field label={label} hint={hint}>
        <Input
          value={value}
          placeholder="https://..."
          className={fieldInputClassName}
          onChange={(e) => onChange(e.target.value)}
        />
        {mediaUploadConfigured ? (
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-neutral-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-neutral-700"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onUploadMedia(kind, file)
              e.target.value = ""
            }}
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Paste an HTTPS URL (upload not configured).
          </p>
        )}
      </Field>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={!busy}
      >
        <div className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {editingId ? "Edit campaign" : "New campaign"}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              Set the message, where clicks go, and when to send. Save as draft
              first if you are still testing.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <FormSection
            title="Basics"
            description="Internal name and status. Visitors only see the title and body below."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Campaign name"
                hint="For your team only — not shown in the notification."
                htmlFor="campaign-name"
              >
                <Input
                  id="campaign-name"
                  value={form.name}
                  placeholder="e.g. Abandon cart — 15m"
                  className={fieldInputClassName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Status"
                hint="Active runs automatically. Draft stays off until you activate."
              >
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      status: value as CampaignFormState["status"],
                    }))
                  }
                >
                  <SelectTrigger
                    className={cn(
                      overviewSelectTriggerClassName,
                      "h-9 w-full rounded-lg"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={overviewSelectContentClassName}>
                    <SelectItem
                      value="draft"
                      className={overviewSelectItemClassName}
                    >
                      Draft
                    </SelectItem>
                    <SelectItem
                      value="active"
                      className={overviewSelectItemClassName}
                    >
                      Active
                    </SelectItem>
                    <SelectItem
                      value="paused"
                      className={overviewSelectItemClassName}
                    >
                      Paused
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Message"
            description="What subscribers see in the notification tray."
          >
            <div className="grid gap-4">
              <Field
                label="Title"
                hint="Keep it short — about 40 characters works best."
                htmlFor="campaign-title"
              >
                <Input
                  id="campaign-title"
                  value={form.title}
                  maxLength={64}
                  placeholder="Still interested?"
                  className={fieldInputClassName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Body"
                hint="One or two lines of supporting text."
                htmlFor="campaign-body"
              >
                <textarea
                  id="campaign-body"
                  value={form.body}
                  rows={3}
                  placeholder="Come back and finish where you left off."
                  className={fieldTextareaClassName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Tag"
                hint="Optional. Same tag replaces an older notification."
                htmlFor="campaign-tag"
                className="sm:max-w-xs"
              >
                <Input
                  id="campaign-tag"
                  value={form.tag}
                  placeholder="abandon-cart"
                  className={fieldInputClassName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tag: e.target.value }))
                  }
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Media"
            description="Optional images. Use square icons; banner shows on supported browsers."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <MediaField
                label="Icon"
                hint="Small square image next to the title."
                kind="icon"
                value={form.iconUrl}
                onChange={(iconUrl) => setForm((f) => ({ ...f, iconUrl }))}
              />
              <MediaField
                label="Badge"
                hint="Tiny monochrome mark (Android / some desktops)."
                kind="badge"
                value={form.badgeUrl}
                onChange={(badgeUrl) => setForm((f) => ({ ...f, badgeUrl }))}
              />
              <MediaField
                label="Banner image"
                hint="Larger preview under the body text."
                kind="image"
                value={form.imageUrl}
                onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
              />
            </div>
          </FormSection>

          <FormSection
            title="Click destination"
            description="Where the user lands when they tap the notification."
          >
            <div className="grid gap-4">
              <Field
                label="Click mode"
                hint="Last seen URL resumes their page. Fixed always opens one link."
              >
                <Select
                  value={form.clickMode}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      clickMode: value as CampaignFormState["clickMode"],
                    }))
                  }
                >
                  <SelectTrigger
                    className={cn(
                      overviewSelectTriggerClassName,
                      "h-9 w-full rounded-lg"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={overviewSelectContentClassName}>
                    <SelectItem
                      value="last_url"
                      className={overviewSelectItemClassName}
                    >
                      Last seen URL
                    </SelectItem>
                    <SelectItem
                      value="fixed"
                      className={overviewSelectItemClassName}
                    >
                      Fixed URL
                    </SelectItem>
                    <SelectItem
                      value="template"
                      className={overviewSelectItemClassName}
                    >
                      Template
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {form.clickMode === "fixed" ? (
                <Field
                  label="Fixed URL"
                  hint="Full HTTPS link opened on every click."
                  htmlFor="campaign-fixed-url"
                >
                  <Input
                    id="campaign-fixed-url"
                    value={form.fixedUrl}
                    placeholder="https://example.com/offer"
                    className={fieldInputClassName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fixedUrl: e.target.value }))
                    }
                  />
                </Field>
              ) : null}

              {form.clickMode === "template" ? (
                <Field
                  label="URL template"
                  hint="Use {{lp_host}} and {{campaign_id}} as placeholders."
                  htmlFor="campaign-url-template"
                >
                  <Input
                    id="campaign-url-template"
                    value={form.urlTemplate}
                    className={fieldInputClassName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        urlTemplate: e.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <OptionRow
                  checked={form.maskedRedirect}
                  onChange={(maskedRedirect) =>
                    setForm((f) => ({ ...f, maskedRedirect }))
                  }
                  title="Masked click URL"
                  description={`Routes via ${clickBaseUrl || "api"}/r/token so opens are tracked.`}
                />
                <Field
                  label="Resume mode"
                  hint="Frozen locks the URL at send time. Fresh uses the latest page."
                >
                  <Select
                    value={form.resumeMode}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        resumeMode: value as "frozen" | "fresh",
                      }))
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        overviewSelectTriggerClassName,
                        "h-9 w-full rounded-lg"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={overviewSelectContentClassName}>
                      <SelectItem
                        value="frozen"
                        className={overviewSelectItemClassName}
                      >
                        Frozen (URL at send time)
                      </SelectItem>
                      <SelectItem
                        value="fresh"
                        className={overviewSelectItemClassName}
                      >
                        Fresh (latest last-seen URL)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="UTM tracking"
            description="Optional tags appended to the click URL for analytics."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="utm_source" htmlFor="campaign-utm-source">
                <Input
                  id="campaign-utm-source"
                  value={form.appendUtmSource}
                  placeholder="push"
                  className={fieldInputClassName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      appendUtmSource: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="utm_medium" htmlFor="campaign-utm-medium">
                <Input
                  id="campaign-utm-medium"
                  value={form.appendUtmMedium}
                  placeholder="web_push"
                  className={fieldInputClassName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      appendUtmMedium: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="utm_campaign" htmlFor="campaign-utm-campaign">
                <Input
                  id="campaign-utm-campaign"
                  value={form.appendUtmCampaign}
                  placeholder="spring-sale"
                  className={fieldInputClassName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      appendUtmCampaign: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="When to send"
            description="Choose a trigger, delay, and events that cancel a pending send."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Trigger"
                hint="Delay and drip wait for an LP event. Immediate is send-now only."
              >
                <Select
                  value={form.triggerType}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      triggerType: value as CampaignFormState["triggerType"],
                    }))
                  }
                >
                  <SelectTrigger
                    className={cn(
                      overviewSelectTriggerClassName,
                      "h-9 w-full rounded-lg"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={overviewSelectContentClassName}>
                    <SelectItem
                      value="delay_after_event"
                      className={overviewSelectItemClassName}
                    >
                      Delay after event
                    </SelectItem>
                    <SelectItem
                      value="drip"
                      className={overviewSelectItemClassName}
                    >
                      Drip sequence
                    </SelectItem>
                    <SelectItem
                      value="immediate"
                      className={overviewSelectItemClassName}
                    >
                      Immediate (manual only)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {form.triggerType === "delay_after_event" ||
              form.triggerType === "drip" ? (
                <Field label="Event" hint="LP event that starts the timer.">
                  <Select
                    value={form.triggerEvent}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        triggerEvent: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        overviewSelectTriggerClassName,
                        "h-9 w-full rounded-lg"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={overviewSelectContentClassName}>
                      {WEB_PUSH_TRIGGER_EVENTS.map((ev) => (
                        <SelectItem
                          key={ev}
                          value={ev}
                          className={overviewSelectItemClassName}
                        >
                          {ev}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              {form.triggerType === "delay_after_event" ? (
                <Field
                  label="Delay (minutes)"
                  hint="Wait this long after the event before sending."
                  htmlFor="campaign-delay"
                >
                  <Input
                    id="campaign-delay"
                    type="number"
                    min={0}
                    value={form.delayMinutes}
                    className={fieldInputClassName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        delayMinutes: e.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}
            </div>

            {form.triggerType === "drip" ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Drip steps
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Each step fires after its own delay from the event.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 rounded-lg border-neutral-200 bg-white shadow-xs"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        dripSteps: [
                          ...f.dripSteps,
                          {
                            delayMinutes: "60",
                            title: "",
                            body: "",
                            tag: `step-${f.dripSteps.length + 1}`,
                          },
                        ],
                      }))
                    }
                  >
                    Add step
                  </Button>
                </div>
                {form.dripSteps.map((step, index) => (
                  <div
                    key={index}
                    className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold tracking-wide text-neutral-600 uppercase">
                        Step {index + 1}
                      </p>
                      {form.dripSteps.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-neutral-600"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              dripSteps: f.dripSteps.filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Delay (min)">
                        <Input
                          type="number"
                          min={0}
                          value={step.delayMinutes}
                          className={fieldInputClassName}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              dripSteps: f.dripSteps.map((s, i) =>
                                i === index
                                  ? { ...s, delayMinutes: e.target.value }
                                  : s
                              ),
                            }))
                          }
                        />
                      </Field>
                      <Field label="Tag">
                        <Input
                          value={step.tag}
                          className={fieldInputClassName}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              dripSteps: f.dripSteps.map((s, i) =>
                                i === index ? { ...s, tag: e.target.value } : s
                              ),
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Title override"
                        hint="Leave blank to use the campaign title."
                      >
                        <Input
                          value={step.title}
                          className={fieldInputClassName}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              dripSteps: f.dripSteps.map((s, i) =>
                                i === index
                                  ? { ...s, title: e.target.value }
                                  : s
                              ),
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Body override"
                        hint="Leave blank to use the campaign body."
                      >
                        <Input
                          value={step.body}
                          className={fieldInputClassName}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              dripSteps: f.dripSteps.map((s, i) =>
                                i === index ? { ...s, body: e.target.value } : s
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Cancel on</p>
                <p className="text-[11px] text-muted-foreground">
                  Drop a pending send if any of these events happen first.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEB_PUSH_TRIGGER_EVENTS.map((ev) => {
                  const checked = form.cancelOn.includes(ev)
                  return (
                    <button
                      key={ev}
                      type="button"
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                        checked
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
                      )}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          cancelOn: checked
                            ? f.cancelOn.filter((x) => x !== ev)
                            : [...f.cancelOn, ev],
                        }))
                      }
                    >
                      {ev}
                    </button>
                  )
                })}
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Limits & behavior"
            description="Cap frequency and avoid sending at awkward hours."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Max pushes / user / 24h"
                hint="Leave blank for no daily cap."
                htmlFor="campaign-max-per-day"
              >
                <Input
                  id="campaign-max-per-day"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.maxPerUserPerDay}
                  className={fieldInputClassName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxPerUserPerDay: e.target.value,
                    }))
                  }
                />
              </Field>
              <OptionRow
                checked={form.requireInteraction}
                onChange={(requireInteraction) =>
                  setForm((f) => ({ ...f, requireInteraction }))
                }
                title="Require interaction"
                description="Keeps the notification until the user dismisses it (desktop)."
              />
            </div>

            <OptionRow
              checked={form.quietEnabled}
              onChange={(quietEnabled) =>
                setForm((f) => ({ ...f, quietEnabled }))
              }
              title="Quiet hours"
              description="Hold sends overnight and deliver after the window ends."
            />

            {form.quietEnabled ? (
              <div className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3.5 sm:grid-cols-3">
                <Field label="Start (HH:mm)" htmlFor="campaign-quiet-start">
                  <Input
                    id="campaign-quiet-start"
                    value={form.quietStart}
                    placeholder="22:00"
                    className={fieldInputClassName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        quietStart: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="End (HH:mm)" htmlFor="campaign-quiet-end">
                  <Input
                    id="campaign-quiet-end"
                    value={form.quietEnd}
                    placeholder="08:00"
                    className={fieldInputClassName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        quietEnd: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Timezone"
                  hint={`Use "user" or an IANA zone like America/New_York.`}
                  htmlFor="campaign-quiet-tz"
                >
                  <Input
                    id="campaign-quiet-tz"
                    value={form.quietTz}
                    placeholder="user"
                    className={fieldInputClassName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quietTz: e.target.value }))
                    }
                  />
                </Field>
              </div>
            ) : null}
          </FormSection>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-200 bg-white px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="h-9 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
            onClick={onSave}
          >
            {busy ? "Saving…" : editingId ? "Save changes" : "Create campaign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
