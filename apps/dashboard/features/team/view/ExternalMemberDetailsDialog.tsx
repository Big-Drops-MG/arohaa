"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  getExternalMemberPrivileges,
  listProjectsForPrivileges,
  removeExternalTeamMember,
  resendExternalMemberInvite,
} from "@/actions/team-member.actions"
import {
  EXTERNAL_PRIVILEGE_TABS,
  type ExternalPrivilegeGrant,
  type ExternalProjectScope,
} from "@/features/team/model/external-privileges"
import type { TeamMember } from "@/features/team/model/team"
import { formatDashboardDateTime } from "@/lib/datetime"

type ExternalMemberDetailsDialogProps = {
  member: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditPrivileges?: (member: TeamMember) => void
}

type ProjectAccessSummary = {
  publicId: string
  brandName: string
  utmSources: string[]
  tabs: { label: string; sections: string[] }[]
}

function buildAccessSummary(
  grants: ExternalPrivilegeGrant[],
  scopes: ExternalProjectScope[],
  projects: { publicId: string; brandName: string }[]
): ProjectAccessSummary[] {
  const brandById = new Map(projects.map((p) => [p.publicId, p.brandName]))
  const utmById = new Map<string, string[]>()
  for (const scope of scopes) {
    const source = scope.utmSource.trim()
    if (!source) continue
    const existing = utmById.get(scope.landingPagePublicId) ?? []
    if (!existing.includes(source)) {
      existing.push(source)
      utmById.set(scope.landingPagePublicId, existing)
    }
  }
  const byProject = new Map<string, Map<string, Set<string>>>()

  for (const grant of grants) {
    let tabs = byProject.get(grant.landingPagePublicId)
    if (!tabs) {
      tabs = new Map()
      byProject.set(grant.landingPagePublicId, tabs)
    }
    let sections = tabs.get(grant.tab)
    if (!sections) {
      sections = new Set()
      tabs.set(grant.tab, sections)
    }
    if (grant.section) sections.add(grant.section)
  }

  const summaries: ProjectAccessSummary[] = []
  for (const [publicId, tabs] of byProject) {
    const tabSummaries: ProjectAccessSummary["tabs"] = []
    for (const tabDef of EXTERNAL_PRIVILEGE_TABS) {
      const sections = tabs.get(tabDef.value)
      if (!sections) continue
      const sectionLabels = tabDef.sections
        .filter((s) => sections.has(s.id))
        .map((s) => s.label)
      tabSummaries.push({
        label: tabDef.label,
        sections: sectionLabels,
      })
    }
    summaries.push({
      publicId,
      brandName: brandById.get(publicId) ?? publicId,
      utmSources: (utmById.get(publicId) ?? []).sort((a, b) =>
        a.localeCompare(b)
      ),
      tabs: tabSummaries,
    })
  }

  summaries.sort((a, b) => a.brandName.localeCompare(b.brandName))
  return summaries
}

export function ExternalMemberDetailsDialog({
  member,
  open,
  onOpenChange,
  onEditPrivileges,
}: ExternalMemberDetailsDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [grants, setGrants] = useState<ExternalPrivilegeGrant[]>([])
  const [scopes, setScopes] = useState<ExternalProjectScope[]>([])
  const [projects, setProjects] = useState<
    { publicId: string; brandName: string }[]
  >([])

  useEffect(() => {
    if (!open || !member) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setConfirmRemove(false)
    setResendMessage(null)

    startTransition(async () => {
      const [privilegesResult, projectsResult] = await Promise.all([
        getExternalMemberPrivileges(member.id),
        listProjectsForPrivileges(),
      ])
      if (cancelled) return
      setLoading(false)
      if (privilegesResult.error) {
        setError(privilegesResult.error)
        return
      }
      if (projectsResult.error) {
        setError(projectsResult.error)
        return
      }
      setGrants(privilegesResult.grants ?? [])
      setScopes(privilegesResult.scopes ?? [])
      setProjects(projectsResult.projects ?? [])
    })

    return () => {
      cancelled = true
    }
  }, [open, member, startTransition])

  const accessSummary = useMemo(
    () => buildAccessSummary(grants, scopes, projects),
    [grants, scopes, projects]
  )

  function handleOpenChange(next: boolean) {
    if (!next) {
      setConfirmRemove(false)
      setError(null)
      setResendMessage(null)
    }
    onOpenChange(next)
  }

  function handleResendInvite() {
    if (!member) return
    setError(null)
    setResendMessage(null)
    setIsResending(true)
    startTransition(async () => {
      const result = await resendExternalMemberInvite(member.id)
      setIsResending(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setResendMessage(
        `New credentials were emailed to ${member.email || "the member"}.`
      )
    })
  }

  function handleRemove() {
    if (!member) return
    setError(null)
    startTransition(async () => {
      const result = await removeExternalTeamMember(member.id)
      if (result.error) {
        setError(result.error)
        setConfirmRemove(false)
        return
      }
      handleOpenChange(false)
      router.refresh()
    })
  }

  if (!member) return null

  const lastSeen = member.lastSeenAt
    ? formatDashboardDateTime(member.lastSeenAt)
    : "Never"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {member.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              External collaborator details and access summary.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Email
              </dt>
              <dd className="break-all text-foreground">
                {member.email || "—"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Role
              </dt>
              <dd className="text-foreground">{member.roleLabel}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Status
              </dt>
              <dd className="text-foreground">
                {member.status === "active" ? "Active recently" : "Inactive"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Last seen
              </dt>
              <dd className="text-foreground">{lastSeen}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">
                Project access
              </h3>
              {onEditPrivileges ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-neutral-200 bg-white text-xs shadow-xs"
                  disabled={isPending}
                  onClick={() => {
                    handleOpenChange(false)
                    onEditPrivileges(member)
                  }}
                >
                  Edit privileges
                </Button>
              ) : null}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading access…
              </div>
            ) : accessSummary.length === 0 ? (
              <p className="rounded-lg border border-border bg-neutral-50 px-3 py-4 text-sm text-muted-foreground">
                No project privileges assigned yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {accessSummary.map((project) => (
                  <li key={project.publicId} className="space-y-1.5 px-3 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {project.brandName}
                      </p>
                      {project.utmSources.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          utm_source: {project.utmSources.join(", ")}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700">
                          No UTM Source set
                        </p>
                      )}
                    </div>
                    <ul className="space-y-1">
                      {project.tabs.map((tab) => (
                        <li
                          key={tab.label}
                          className="text-xs text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">
                            {tab.label}
                          </span>
                          {tab.sections.length > 0
                            ? ` — ${tab.sections.join(", ")}`
                            : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {confirmRemove ? (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
              <p className="text-sm text-foreground">
                Remove <span className="font-medium">{member.name}</span>? They
                will lose dashboard access immediately and cannot sign in with
                their current credentials.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-neutral-200 bg-white shadow-xs"
                  disabled={isPending}
                  onClick={() => setConfirmRemove(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 rounded-lg"
                  disabled={isPending}
                  onClick={handleRemove}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Confirm remove
                </Button>
              </div>
            </div>
          ) : null}

          {resendMessage ? (
            <p className="text-sm text-emerald-700" role="status">
              {resendMessage}
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-white px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isPending || confirmRemove}
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 className="size-3.5" />
            Remove user
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
              disabled={
                isPending || isResending || confirmRemove || !member.email
              }
              onClick={handleResendInvite}
            >
              {isResending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-3.5" />
              )}
              Resend credentials
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
