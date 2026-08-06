"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, Plus, ScrollText, Shield, Trash2 } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type {
  AccessRequestItem,
  TeamDashboardData,
  TeamMember,
} from "@/features/team/model/team"
import {
  TEAM_NAV_ITEMS,
  TeamNav,
  type TeamSectionId,
} from "@/features/team/view/TeamNav"
import { AddExternalMemberDialog } from "@/features/team/view/AddExternalMemberDialog"
import { ExternalMemberDetailsDialog } from "@/features/team/view/ExternalMemberDetailsDialog"
import { TeamMemberLogsPanel } from "@/features/team/view/TeamMemberLogsPanel"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { formatDashboardDateTime } from "@/lib/datetime"
import {
  acceptAccessRequest,
  rejectAccessRequest,
} from "@/actions/access-request.actions"
import { removeExternalTeamMember } from "@/actions/team-member.actions"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"

type TeamDashboardProps = {
  data: TeamDashboardData
}

function parseTeamSection(value: string | null): TeamSectionId {
  if (value && TEAM_NAV_ITEMS.some((item) => item.id === value)) {
    return value as TeamSectionId
  }
  return "internal"
}

function formatExactLastSeen(iso: string | null): string {
  if (!iso) return "Never"
  return formatDashboardDateTime(iso)
}

type MemberListProps = {
  members: TeamMember[]
  selectedMemberId: string | null
  onViewLogs: (member: TeamMember) => void
  onEditPrivileges?: (member: TeamMember) => void
  onViewDetails?: (member: TeamMember) => void
  onRemoveMember?: (member: TeamMember) => void
  removingMemberId?: string | null
}

function MemberList({
  members,
  selectedMemberId,
  onViewLogs,
  onEditPrivileges,
  onViewDetails,
  onRemoveMember,
  removingMemberId,
}: MemberListProps) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No users found.</p>
  }

  return (
    <ul className="space-y-0">
      {members.map((member, index) => {
        const isActive = member.status === "active"
        const isSelected = selectedMemberId === member.id
        const isRemoving = removingMemberId === member.id
        return (
          <li key={member.id}>
            {index > 0 ? (
              <div
                className="mx-2 h-px bg-neutral-200/80"
                role="separator"
                aria-hidden
              />
            ) : null}
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-3 transition-colors",
                isSelected && "bg-muted/50"
              )}
            >
              <div className="relative shrink-0">
                <div className="flex size-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                  {member.initials}
                </div>
                <span
                  className={cn(
                    "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-white",
                    isActive ? "bg-emerald-500" : "bg-neutral-300"
                  )}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">
                    {member.name}
                    {member.isCurrentUser ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <span className="inline-flex max-w-full shrink-0 items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                    <span className="truncate">{member.roleLabel}</span>
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email || "—"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Last seen {formatExactLastSeen(member.lastSeenAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {onViewDetails ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    disabled={isRemoving}
                    onClick={() => onViewDetails(member)}
                  >
                    <Eye className="size-3.5" aria-hidden />
                    <span className="hidden md:inline">Details</span>
                  </Button>
                ) : null}
                {onEditPrivileges ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    disabled={isRemoving}
                    onClick={() => onEditPrivileges(member)}
                  >
                    <Shield className="size-3.5" aria-hidden />
                    <span className="hidden md:inline">Privileges</span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 shrink-0 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground",
                    isSelected && "bg-background text-foreground shadow-xs"
                  )}
                  aria-pressed={isSelected}
                  disabled={isRemoving}
                  onClick={() => onViewLogs(member)}
                >
                  <ScrollText className="size-3.5" aria-hidden />
                  <span className="hidden md:inline">
                    {isSelected ? "Viewing" : "View logs"}
                  </span>
                </Button>
                {onRemoveMember ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isRemoving}
                    onClick={() => onRemoveMember(member)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    <span className="hidden md:inline">
                      {isRemoving ? "Removing…" : "Remove"}
                    </span>
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

type PendingRequestsSectionProps = {
  requests: AccessRequestItem[]
  canReview: boolean
  error: string | null
  pendingId: string | null
  isPending: boolean
  onReview: (userId: string, decision: "accepted" | "rejected") => void
}

function PendingRequestsSection({
  requests,
  canReview,
  error,
  pendingId,
  isPending,
  onReview,
}: PendingRequestsSectionProps) {
  const description =
    requests.length === 0
      ? "No pending requests."
      : canReview
        ? `${requests.length} pending ${requests.length === 1 ? "request" : "requests"}.`
        : `${requests.length} pending ${requests.length === 1 ? "request" : "requests"}. Only the CEO can accept or reject.`

  return (
    <SettingsSectionCard title="Pending Requests" description={description}>
      {error ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          New users appear here after they complete onboarding.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((request) => {
            const busy = isPending && pendingId === request.id
            return (
              <li
                key={request.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                    {request.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {request.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {request.email || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {request.roleLabel}
                    </p>
                  </div>
                </div>
                {canReview ? (
                  <div className="flex shrink-0 gap-2 sm:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy || isPending}
                      onClick={() => onReview(request.id, "rejected")}
                    >
                      {busy ? "…" : "Reject"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || isPending}
                      onClick={() => onReview(request.id, "accepted")}
                    >
                      {busy ? "…" : "Accept"}
                    </Button>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium tracking-wide text-amber-800 uppercase">
                    Pending CEO review
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SettingsSectionCard>
  )
}

export function TeamDashboard({ data }: TeamDashboardProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [isAddExternalOpen, setIsAddExternalOpen] = useState(false)
  const [editPrivilegesMember, setEditPrivilegesMember] =
    useState<TeamMember | null>(null)
  const [detailsMember, setDetailsMember] = useState<TeamMember | null>(null)
  const [removeConfirmMember, setRemoveConfirmMember] =
    useState<TeamMember | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useDashboardQueryParam("section", {
    parse: parseTeamSection,
    omitDefault: true,
  })

  const canReview = data.canReviewAccessRequests

  const internalMembers = useMemo(
    () => data.members.filter((member) => member.kind === "internal"),
    [data.members]
  )
  const externalMembers = useMemo(
    () => data.members.filter((member) => member.kind === "external"),
    [data.members]
  )

  const selectedMember = useMemo(
    () => data.members.find((member) => member.id === selectedMemberId) ?? null,
    [data.members, selectedMemberId]
  )

  useEffect(() => {
    setSelectedMemberId(null)
  }, [activeSection])

  function review(userId: string, decision: "accepted" | "rejected") {
    if (!canReview) return
    setError(null)
    setPendingId(userId)
    startTransition(async () => {
      const result =
        decision === "accepted"
          ? await acceptAccessRequest(userId)
          : await rejectAccessRequest(userId)
      setPendingId(null)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleViewLogs(member: TeamMember) {
    setSelectedMemberId((current) => (current === member.id ? null : member.id))
  }

  function handleConfirmRemove() {
    const member = removeConfirmMember
    if (!member) return
    setRemoveError(null)
    setRemovingMemberId(member.id)
    startTransition(async () => {
      const result = await removeExternalTeamMember(member.id)
      setRemovingMemberId(null)
      if (result.error) {
        setRemoveError(result.error)
        return
      }
      setRemoveConfirmMember(null)
      if (selectedMemberId === member.id) setSelectedMemberId(null)
      if (detailsMember?.id === member.id) setDetailsMember(null)
      if (editPrivilegesMember?.id === member.id) setEditPrivilegesMember(null)
      router.refresh()
    })
  }

  const logsOpen = Boolean(selectedMember)

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 pb-6 sm:px-6 lg:px-8">
      <div className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Team
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Manage internal members, external collaborators, and pending access
          requests.
        </p>
      </div>

      <div
        className={cn(
          "grid gap-6 lg:items-start",
          logsOpen
            ? "lg:grid-cols-[16rem_minmax(0,1fr)_minmax(20rem,24rem)]"
            : "lg:grid-cols-[16rem_minmax(0,1fr)]"
        )}
      >
        <TeamNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          counts={{
            internal: internalMembers.length,
            external: externalMembers.length,
            pending: data.accessRequests.length,
          }}
        />

        <div className="min-w-0 space-y-4">
          {activeSection === "internal" ? (
            <SettingsSectionCard
              title="Internal Team"
              description={`${internalMembers.length} approved ${internalMembers.length === 1 ? "member" : "members"}.`}
            >
              <MemberList
                members={internalMembers}
                selectedMemberId={selectedMemberId}
                onViewLogs={handleViewLogs}
              />
            </SettingsSectionCard>
          ) : null}

          {activeSection === "external" ? (
            <SettingsSectionCard
              title="External Team"
              description={
                externalMembers.length === 0
                  ? "No external collaborators yet."
                  : `${externalMembers.length} external ${externalMembers.length === 1 ? "member" : "members"}.`
              }
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-neutral-200 bg-white shadow-xs"
                  onClick={() => setIsAddExternalOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Add member
                </Button>
              }
            >
              {externalMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  External partners and collaborators will appear here once
                  added.
                </p>
              ) : (
                <MemberList
                  members={externalMembers}
                  selectedMemberId={selectedMemberId}
                  onViewLogs={handleViewLogs}
                  onEditPrivileges={setEditPrivilegesMember}
                  onViewDetails={setDetailsMember}
                  onRemoveMember={setRemoveConfirmMember}
                  removingMemberId={removingMemberId}
                />
              )}
            </SettingsSectionCard>
          ) : null}

          {activeSection === "pending" ? (
            <PendingRequestsSection
              requests={data.accessRequests}
              canReview={canReview}
              error={error}
              pendingId={pendingId}
              isPending={isPending}
              onReview={review}
            />
          ) : null}
        </div>

        {selectedMember ? (
          <div className="min-w-0">
            <TeamMemberLogsPanel
              key={selectedMember.id}
              member={selectedMember}
              onClose={() => setSelectedMemberId(null)}
            />
          </div>
        ) : null}
      </div>

      <AddExternalMemberDialog
        open={isAddExternalOpen}
        onOpenChange={setIsAddExternalOpen}
      />
      <AddExternalMemberDialog
        key={editPrivilegesMember?.id ?? "edit-closed"}
        open={Boolean(editPrivilegesMember)}
        onOpenChange={(next) => {
          if (!next) setEditPrivilegesMember(null)
        }}
        mode={
          editPrivilegesMember
            ? {
                kind: "edit",
                userId: editPrivilegesMember.id,
                memberName: editPrivilegesMember.name,
              }
            : { kind: "create" }
        }
      />
      <ExternalMemberDetailsDialog
        member={detailsMember}
        open={Boolean(detailsMember)}
        onOpenChange={(next) => {
          if (!next) setDetailsMember(null)
        }}
        onEditPrivileges={(member) => {
          setDetailsMember(null)
          setEditPrivilegesMember(member)
        }}
      />

      <Dialog
        open={Boolean(removeConfirmMember)}
        onOpenChange={(next) => {
          if (!next) {
            setRemoveConfirmMember(null)
            setRemoveError(null)
          }
        }}
      >
        <DialogContent className="max-w-md gap-4">
          <DialogHeader>
            <DialogTitle>Remove external member</DialogTitle>
            <DialogDescription>
              {removeConfirmMember
                ? `Remove ${removeConfirmMember.name}? Their account will be permanently deleted and they will lose dashboard access immediately.`
                : "This member will lose dashboard access."}
            </DialogDescription>
          </DialogHeader>
          {removeError ? (
            <p className="text-sm text-destructive" role="alert">
              {removeError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
              disabled={Boolean(removingMemberId)}
              onClick={() => {
                setRemoveConfirmMember(null)
                setRemoveError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9 rounded-lg"
              disabled={Boolean(removingMemberId)}
              onClick={handleConfirmRemove}
            >
              <Trash2 className="size-3.5" />
              {removingMemberId ? "Removing…" : "Remove user"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
