"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

type Finding = {
  code?: string
  detail?: string
  availability?: string
  severity?: string
  modelVersion?: string
  observedAt?: string
  contributesToScore?: boolean
  shadow?: boolean
}

type SessionEvidencePayload = {
  sessionId: string
  workspaceId: string
  sdkVersion: string
  sdkCapabilities: string
  timeline: Array<{ eventName: string; createdAt: string; seq: number }>
  integrityFindings: Finding[]
  browserObs: unknown | null
  behaviorSummary: unknown | null
  attribution: {
    firstUtmSource: string
    submitUtmSource: string
    referrerOrigin: string
  }
  network: {
    networkClass: string
    asn: number
    org: string
    evidenceSource: string
    evidenceAsOf: string
  }
  location: {
    formZip: string
    geoZip: string
    geoCountry: string
    geoState: string
    geoCity: string
  }
}

function FindingList({
  title,
  findings,
}: {
  title: string
  findings: Finding[]
}) {
  if (!findings.length) {
    return (
      <section className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">None recorded</p>
      </section>
    )
  }
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="space-y-2">
        {findings.map((f, i) => (
          <li
            key={`${f.code ?? "f"}-${i}`}
            className="rounded border border-border px-2 py-1.5 text-xs"
          >
            <div className="font-mono">{f.code || "unknown"}</div>
            <div className="text-muted-foreground">{f.detail || "—"}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {[
                f.availability ? `availability: ${f.availability}` : "",
                f.severity ? `severity: ${f.severity}` : "",
                f.modelVersion ? `model: ${f.modelVersion}` : "",
                f.shadow ? "shadow" : "",
                f.contributesToScore === false ? "non-scoring" : "",
                f.observedAt ? `observed: ${f.observedAt}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SessionEvidenceDialog({
  open,
  onOpenChange,
  workspaceId,
  sessionId,
  tenantWorkspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  sessionId: string
  tenantWorkspaceId?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<SessionEvidencePayload | null>(null)

  useEffect(() => {
    if (!open || !workspaceId || !sessionId) return
    let cancelled = false
    setLoading(true)
    setError("")
    setData(null)
    const params = new URLSearchParams({
      workspaceId,
      sessionId,
    })
    if (tenantWorkspaceId) params.set("tenantWorkspaceId", tenantWorkspaceId)
    void fetch(`/api/warehouse/session-evidence?${params.toString()}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json()) as SessionEvidencePayload & {
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setError(body.error || `Failed (${res.status})`)
          return
        }
        setData(body)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceId, sessionId, tenantWorkspaceId])

  const findings = (data?.integrityFindings ?? []).filter((f): f is Finding =>
    Boolean(f && typeof f === "object")
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session evidence</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No evidence</p>
        ) : (
          <div className="space-y-4 text-sm">
            <section className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                SDK version:{" "}
                <span className="text-foreground">
                  {data.sdkVersion || "unknown"}
                </span>
              </div>
              <div>
                Capabilities:{" "}
                <span className="text-foreground">
                  {data.sdkCapabilities || "none"}
                </span>
              </div>
              <div className="sm:col-span-2">
                Missing capabilities reduce coverage; they do not imply fraud.
              </div>
            </section>

            <FindingList
              title="Telemetry / integrity findings"
              findings={findings}
            />

            <section className="space-y-1">
              <h3 className="text-sm font-medium">Attribution</h3>
              <p className="text-xs text-muted-foreground">
                First: {data.attribution.firstUtmSource || "—"} · Submit:{" "}
                {data.attribution.submitUtmSource || "—"} · Referrer:{" "}
                {data.attribution.referrerOrigin || "—"}
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="text-sm font-medium">Network</h3>
              <p className="text-xs text-muted-foreground">
                {data.network.networkClass || "unavailable"}
                {data.network.org ? ` · ${data.network.org}` : ""}
                {data.network.asn ? ` · ASN ${data.network.asn}` : ""}
                {data.network.evidenceAsOf
                  ? ` · as of ${data.network.evidenceAsOf}`
                  : ""}
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="text-sm font-medium">Location</h3>
              <p className="text-xs text-muted-foreground">
                Form ZIP: {data.location.formZip || "—"} · Geo:{" "}
                {[
                  data.location.geoCity,
                  data.location.geoState,
                  data.location.geoCountry,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="text-sm font-medium">Behavior summary</h3>
              <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                {data.behaviorSummary
                  ? JSON.stringify(data.behaviorSummary, null, 2)
                  : "Not received"}
              </pre>
            </section>

            <section className="space-y-1">
              <h3 className="text-sm font-medium">Browser observations</h3>
              <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                {data.browserObs
                  ? JSON.stringify(data.browserObs, null, 2)
                  : "Not received"}
              </pre>
            </section>

            <section className="space-y-1">
              <h3 className="text-sm font-medium">Timeline</h3>
              <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                {data.timeline.map((e, i) => (
                  <li
                    key={`${e.eventName}-${e.seq}-${i}`}
                    className="font-mono"
                  >
                    {e.createdAt} · seq {e.seq} · {e.eventName}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
