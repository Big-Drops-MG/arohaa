"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Shield,
  Terminal,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import type {
  NotificationCenterDashboardData,
  NotificationCenterVapid,
  NotificationCenterWebhook,
} from "@/features/notification-center/model/notification-center"
import { buildLpWebPushOpsSnippet } from "@/features/notification-center/model/lp-ops-snippet"

type KeysPendingAction = "vapid" | "webhook" | null

type NotificationCenterKeysTabProps = {
  data: NotificationCenterDashboardData
  freshWebhookSecret: string | null
  pendingAction: KeysPendingAction
  onGenerateVapid: () => Promise<boolean>
  onGenerateWebhookSecret: () => Promise<boolean>
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return null
  }
}

function StatusPill({
  tone,
  children,
}: {
  tone: "ready" | "warning" | "muted" | "danger"
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        tone === "ready" && "bg-emerald-50 text-emerald-700",
        tone === "warning" && "bg-amber-50 text-amber-800",
        tone === "danger" && "bg-red-50 text-red-700",
        tone === "muted" && "bg-neutral-100 text-neutral-600"
      )}
    >
      {children}
    </span>
  )
}

function KeysCard({
  title,
  description,
  status,
  action,
  children,
}: {
  title: string
  description: string
  status?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 sm:px-6">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            {status}
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

function CopyField({
  label,
  value,
  hint,
  mono = true,
  emphasize = false,
}: {
  label: string
  value: string
  hint?: string
  mono?: boolean
  emphasize?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard can fail in insecure contexts */
    }
  }, [value])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? (
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "flex items-stretch gap-2 rounded-lg border p-1.5 pl-3",
          emphasize
            ? "border-amber-200 bg-amber-50/60"
            : "border-neutral-200 bg-neutral-50/80"
        )}
      >
        <code
          className={cn(
            "min-w-0 flex-1 self-center text-xs leading-relaxed break-all text-foreground",
            mono && "font-mono"
          )}
        >
          {value}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1.5 rounded-md border-neutral-200 bg-white shadow-xs"
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-600" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-xs">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {action}
    </div>
  )
}

function SetupStep({
  done,
  label,
  detail,
}: {
  done: boolean
  label: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-emerald-600"
          aria-hidden
        />
      ) : (
        <Circle
          className="mt-0.5 size-4 shrink-0 text-neutral-300"
          aria-hidden
        />
      )}
      <div className="min-w-0 space-y-0.5">
        <p
          className={cn(
            "text-sm font-medium",
            done ? "text-foreground" : "text-neutral-700"
          )}
        >
          {label}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  )
}

function VapidCard({
  vapid,
  pending,
  onGenerate,
  onRequestRotate,
}: {
  vapid: NotificationCenterVapid | null
  pending: boolean
  onGenerate: () => void
  onRequestRotate: () => void
}) {
  const rotated = formatWhen(vapid?.rotatedAt)
  const created = formatWhen(vapid?.createdAt)

  return (
    <KeysCard
      title="VAPID keys"
      description="Browsers need the public key to subscribe. Keep the private key in Arohaa only."
      status={
        vapid ? (
          <StatusPill tone="ready">Ready</StatusPill>
        ) : (
          <StatusPill tone="warning">Required</StatusPill>
        )
      }
      action={
        vapid ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-8 gap-1.5 rounded-lg border-neutral-200 bg-white shadow-xs"
            onClick={onRequestRotate}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {pending ? "Rotating…" : "Rotate keys"}
          </Button>
        ) : null
      }
    >
      {vapid ? (
        <div className="space-y-4">
          <CopyField
            label="Public key"
            hint="NEXT_PUBLIC_VAPID_PUBLIC_KEY"
            value={vapid.publicKey}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 px-3.5 py-3">
              <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                Subject
              </p>
              <p className="mt-1 truncate text-sm text-foreground">
                {vapid.subject}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 px-3.5 py-3">
              <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                {rotated ? "Last rotated" : "Created"}
              </p>
              <p className="mt-1 text-sm text-foreground tabular-nums">
                {rotated ?? created ?? "—"}
              </p>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            After rotating, update the public key on every landing page that
            uses this project.
          </p>
        </div>
      ) : (
        <EmptyState
          icon={<KeyRound className="size-4" aria-hidden />}
          title="No VAPID pair yet"
          description="Generate keys before visitors can subscribe or campaigns can send."
          action={
            <Button
              type="button"
              size="sm"
              disabled={pending}
              className="h-9 gap-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              onClick={onGenerate}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="size-3.5" aria-hidden />
              )}
              {pending ? "Generating…" : "Generate keys"}
            </Button>
          }
        />
      )}
    </KeysCard>
  )
}

function WebhookCard({
  webhook,
  freshSecret,
  pending,
  onGenerate,
  onRequestRotate,
}: {
  webhook: NotificationCenterWebhook
  freshSecret: string | null
  pending: boolean
  onGenerate: () => void
  onRequestRotate: () => void
}) {
  const rotated = formatWhen(webhook.rotatedAt)

  return (
    <KeysCard
      title="Webhook HMAC secret"
      description="Landing pages sign subscribe and event requests so only your LPs can talk to Arohaa."
      status={
        freshSecret ? (
          <StatusPill tone="warning">Copy now</StatusPill>
        ) : webhook.configured ? (
          <StatusPill tone="ready">Secured</StatusPill>
        ) : (
          <StatusPill tone="danger">Open</StatusPill>
        )
      }
      action={
        webhook.configured ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-8 gap-1.5 rounded-lg border-neutral-200 bg-white shadow-xs"
            onClick={onRequestRotate}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {pending ? "Rotating…" : "Rotate secret"}
          </Button>
        ) : null
      }
    >
      {freshSecret ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-amber-700"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-950">
                Secret shown once
              </p>
              <p className="text-xs leading-relaxed text-amber-900/80">
                Copy it into your LP env now. Arohaa will only store a hash
                after this.
              </p>
            </div>
          </div>
          <CopyField
            label="Webhook secret"
            hint="WEB_PUSH_WEBHOOK_SECRET"
            value={freshSecret}
            emphasize
          />
        </div>
      ) : null}

      {!freshSecret && webhook.configured ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                Stored secret
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {webhook.secretPrefix}…
              </p>
            </div>
            {rotated ? (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Rotated {rotated}
              </p>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            LPs must send{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">
              x-arohaa-web-push-signature
            </code>{" "}
            on subscribe and events. Rotate only when you can update every LP.
          </p>
        </div>
      ) : null}

      {!freshSecret && !webhook.configured ? (
        <EmptyState
          icon={<Shield className="size-4" aria-hidden />}
          title="No webhook secret"
          description="Until you generate one, webhooks are accepted without HMAC. Fine for local dev — not for production."
          action={
            <Button
              type="button"
              size="sm"
              disabled={pending}
              className="h-9 gap-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              onClick={onGenerate}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Shield className="size-3.5" aria-hidden />
              )}
              {pending ? "Generating…" : "Generate secret"}
            </Button>
          }
        />
      ) : null}
    </KeysCard>
  )
}

function WiringCard({
  ingestBaseUrl,
  landingPagePublicId,
  vapidPublicKey,
  webhookSecretPlaintext,
  webhookConfigured,
}: {
  ingestBaseUrl: string | null
  landingPagePublicId: string
  vapidPublicKey: string | null
  webhookSecretPlaintext: string | null
  webhookConfigured: boolean
}) {
  const snippet = buildLpWebPushOpsSnippet({
    ingestBaseUrl,
    landingPagePublicId,
    vapidPublicKey,
    webhookSecretPlaintext,
  })
  const [copied, setCopied] = useState(false)
  const hasVapid = Boolean(vapidPublicKey)
  const hasSecret = Boolean(webhookSecretPlaintext) || webhookConfigured
  const envReady = hasVapid && Boolean(webhookSecretPlaintext)

  const handleCopyEnv = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet.envFile)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [snippet.envFile])

  return (
    <KeysCard
      title="LP wiring"
      description="Paste these into the landing page, then wire the SDK proxy and service worker."
      status={
        hasVapid && hasSecret ? (
          <StatusPill tone="ready">Ready to wire</StatusPill>
        ) : (
          <StatusPill tone="muted">Incomplete</StatusPill>
        )
      }
      action={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!envReady}
          className="h-8 gap-1.5 rounded-lg"
          onClick={() => void handleCopyEnv()}
          title={
            envReady
              ? undefined
              : "Generate VAPID and reveal a webhook secret first"
          }
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-600" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied ? "Copied env" : "Copy env"}
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Checklist
          </p>
          <div className="space-y-3">
            <SetupStep
              done={hasVapid}
              label="VAPID public key"
              detail="Generate keys above, then set NEXT_PUBLIC_VAPID_PUBLIC_KEY."
            />
            <SetupStep
              done={hasSecret}
              label="Webhook secret"
              detail={
                webhookSecretPlaintext
                  ? "Fresh secret is in the env snippet below."
                  : webhookConfigured
                    ? "Secret is set. Rotate to reveal a new value for the env file."
                    : "Generate a secret so LP requests can be verified."
              }
            />
            <SetupStep
              done={false}
              label="SDK + service worker"
              detail={`Add ${snippet.sdkAttr} and forward /api/push/* with @workspace/lp-core.`}
            />
          </div>
          <ol className="space-y-1.5 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {snippet.checklist.slice(2).map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300" />
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Terminal className="size-3.5 text-neutral-500" aria-hidden />
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Env snippet
            </p>
          </div>
          {!envReady ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              Finish VAPID and generate a webhook secret (copy the one-time
              value) before using this snippet in production.
            </p>
          ) : null}
          <pre className="max-h-56 overflow-auto rounded-xl border border-neutral-200 bg-neutral-950 p-3.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-neutral-100">
            {snippet.envFile}
          </pre>
          {ingestBaseUrl ? (
            <p className="text-[11px] text-muted-foreground">
              Subscribe endpoint:{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-foreground">
                {ingestBaseUrl.replace(/\/$/, "")}/v1/web-push/subscriptions
              </code>
            </p>
          ) : null}
        </div>
      </div>
    </KeysCard>
  )
}

export function NotificationCenterKeysTab({
  data,
  freshWebhookSecret,
  pendingAction,
  onGenerateVapid,
  onGenerateWebhookSecret,
}: NotificationCenterKeysTabProps) {
  const [confirm, setConfirm] = useState<"vapid" | "webhook" | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!success) return
    const id = window.setTimeout(() => setSuccess(null), 4000)
    return () => window.clearTimeout(id)
  }, [success])

  const vapidReady = Boolean(data.vapid)
  const webhookReady = data.webhook.configured || Boolean(freshWebhookSecret)
  const readyCount = [vapidReady, webhookReady].filter(Boolean).length

  async function runGenerateVapid() {
    const wasReady = Boolean(data.vapid)
    setConfirm(null)
    const ok = await onGenerateVapid()
    if (ok) {
      setSuccess(
        wasReady
          ? "VAPID keys rotated. Update the public key on every landing page."
          : "VAPID keys generated. Copy the public key into your LP env."
      )
    }
  }

  async function runGenerateWebhook() {
    const wasReady = data.webhook.configured
    setConfirm(null)
    const ok = await onGenerateWebhookSecret()
    if (ok) {
      setSuccess(
        wasReady
          ? "Webhook secret rotated. Copy the new value now — it won't be shown again."
          : "Webhook secret created. Copy it now — it won't be shown again."
      )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-neutral-200/80 bg-white px-5 py-4 shadow-xs sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Push credentials
            </h2>
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              Generate keys here, then wire them on the landing page. Private
              material never leaves Arohaa except the one-time webhook secret.
            </p>
          </div>
          <StatusPill tone={readyCount === 2 ? "ready" : "warning"}>
            {readyCount}/2 ready
          </StatusPill>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SetupStep
            done={vapidReady}
            label="VAPID"
            detail={
              vapidReady
                ? "Public key ready to copy"
                : "Required before subscribe or send"
            }
          />
          <SetupStep
            done={webhookReady}
            label="Webhook HMAC"
            detail={
              freshWebhookSecret
                ? "New secret waiting to be copied"
                : webhookReady
                  ? "Requests must be signed"
                  : "Open until you generate a secret"
            }
          />
        </div>
      </section>

      {success ? (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="leading-relaxed">{success}</p>
        </div>
      ) : null}

      <VapidCard
        vapid={data.vapid}
        pending={pendingAction === "vapid"}
        onGenerate={() => void runGenerateVapid()}
        onRequestRotate={() => setConfirm("vapid")}
      />

      <WebhookCard
        webhook={data.webhook}
        freshSecret={freshWebhookSecret}
        pending={pendingAction === "webhook"}
        onGenerate={() => void runGenerateWebhook()}
        onRequestRotate={() => setConfirm("webhook")}
      />

      <WiringCard
        ingestBaseUrl={data.ingestBaseUrl}
        landingPagePublicId={data.landingPagePublicId}
        vapidPublicKey={data.vapid?.publicKey ?? null}
        webhookSecretPlaintext={freshWebhookSecret}
        webhookConfigured={data.webhook.configured}
      />

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (pendingAction) return
          if (!open) setConfirm(null)
        }}
      >
        <DialogContent
          className="max-w-md gap-4"
          showCloseButton={!pendingAction}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              {confirm === "vapid"
                ? "Rotate VAPID keys?"
                : "Rotate webhook secret?"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {confirm === "vapid"
                ? "Existing subscriptions keep working only if every LP gets the new public key. Update NEXT_PUBLIC_VAPID_PUBLIC_KEY right after rotating."
                : "The old secret stops working immediately. Copy the new value into WEB_PUSH_WEBHOOK_SECRET on every landing page before traffic resumes."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
              disabled={Boolean(pendingAction)}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-9 gap-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              disabled={Boolean(pendingAction)}
              onClick={() =>
                void (confirm === "vapid"
                  ? runGenerateVapid()
                  : runGenerateWebhook())
              }
            >
              {pendingAction ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              {pendingAction ? "Rotating…" : "Rotate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export type { KeysPendingAction }
