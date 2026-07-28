"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import type { TeamDashboardData } from "@/features/team/model/team"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { formatDashboardDateTime } from "@/lib/datetime"
import {
  acceptAccessRequest,
  rejectAccessRequest,
} from "@/actions/access-request.actions"

type TeamDashboardProps = {
  data: TeamDashboardData
}

function formatExactLastSeen(iso: string | null): string {
  if (!iso) return "Never"
  return formatDashboardDateTime(iso)
}

export function TeamDashboard({ data }: TeamDashboardProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const canReview = data.canReviewAccessRequests

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

  const requestDescription =
    data.accessRequests.length === 0
      ? "No pending requests."
      : canReview
        ? `${data.accessRequests.length} pending ${data.accessRequests.length === 1 ? "request" : "requests"}.`
        : `${data.accessRequests.length} pending ${data.accessRequests.length === 1 ? "request" : "requests"}. Only the CEO can accept or reject.`

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
      <div className="pt-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage access requests and approved team members.
        </p>
      </div>

      <SettingsSectionCard
        title="Access requests"
        description={requestDescription}
      >
        {error ? (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {data.accessRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            New users appear here after they complete onboarding.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.accessRequests.map((request) => {
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
                        onClick={() => review(request.id, "rejected")}
                      >
                        {busy ? "…" : "Reject"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || isPending}
                        onClick={() => review(request.id, "accepted")}
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

      <SettingsSectionCard
        title="Users"
        description={`${data.members.length} approved ${data.members.length === 1 ? "member" : "members"}.`}
      >
        {data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.members.map((member) => {
              const isActive = member.status === "active"
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
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
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.name}
                      {member.isCurrentUser ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Last seen {formatExactLastSeen(member.lastSeenAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-600"
                      )}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {member.roleLabel}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SettingsSectionCard>
    </div>
  )
}
