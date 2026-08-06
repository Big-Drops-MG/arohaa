"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Eye, EyeOff, Loader2, RefreshCw, Shield } from "lucide-react"
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
import { cn } from "@workspace/ui/lib/utils"
import {
  createExternalTeamMember,
  getExternalMemberPrivileges,
  listProjectsForPrivileges,
  saveExternalMemberPrivileges,
} from "@/actions/team-member.actions"
import {
  ExternalPrivilegesEditor,
  type PrivilegeProjectOption,
} from "@/features/team/view/ExternalPrivilegesEditor"
import type {
  ExternalPrivilegeGrant,
  ExternalProjectScope,
} from "@/features/team/model/external-privileges"

type WizardMode =
  | { kind: "create" }
  | { kind: "edit"; userId: string; memberName: string }

type AddExternalMemberDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: WizardMode
}

function generateStrongPassword(length = 20): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*"
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}

export function AddExternalMemberDialog({
  open,
  onOpenChange,
  mode = { kind: "create" },
}: AddExternalMemberDialogProps) {
  const router = useRouter()
  const isEdit = mode.kind === "edit"
  const [step, setStep] = useState<"details" | "privileges">(
    isEdit ? "privileges" : "details"
  )
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [createdUserId, setCreatedUserId] = useState<string | null>(
    isEdit && mode.kind === "edit" ? mode.userId : null
  )
  const [emailSent, setEmailSent] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<PrivilegeProjectOption[]>([])
  const [grants, setGrants] = useState<ExternalPrivilegeGrant[]>([])
  const [scopes, setScopes] = useState<ExternalProjectScope[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingPrivileges, setLoadingPrivileges] = useState(isEdit)

  const canSubmitDetails =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 12 &&
    !isPending

  function resetForm() {
    setStep(isEdit ? "privileges" : "details")
    setFirstName("")
    setLastName("")
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setCreatedUserId(isEdit && mode.kind === "edit" ? mode.userId : null)
    setEmailSent(null)
    setProjects([])
    setGrants([])
    setScopes([])
    setError(null)
    setLoadingPrivileges(isEdit)
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open || mode.kind !== "edit") return
    let cancelled = false
    startTransition(async () => {
      const [projectsResult, grantsResult] = await Promise.all([
        listProjectsForPrivileges(),
        getExternalMemberPrivileges(mode.userId),
      ])
      if (cancelled) return
      setLoadingPrivileges(false)
      if (projectsResult.error) {
        setError(projectsResult.error)
        return
      }
      if (grantsResult.error) {
        setError(grantsResult.error)
        return
      }
      setProjects(projectsResult.projects ?? [])
      setGrants(grantsResult.grants ?? [])
      setScopes(grantsResult.scopes ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [open, mode, startTransition])

  function handleGeneratePassword() {
    setPassword(generateStrongPassword())
    setShowPassword(true)
  }

  function handleCreate() {
    if (!canSubmitDetails) return
    setError(null)
    startTransition(async () => {
      const result = await createExternalTeamMember({
        firstName,
        lastName,
        email,
        password,
      })
      if (result.error || !result.userId) {
        setError(result.error ?? "Could not create member.")
        return
      }
      setCreatedUserId(result.userId)
      setEmailSent(result.emailSent ?? false)
      const projectsResult = await listProjectsForPrivileges()
      if (projectsResult.error) {
        setError(projectsResult.error)
        return
      }
      setProjects(projectsResult.projects ?? [])
      setGrants([])
      setScopes([])
      setStep("privileges")
      router.refresh()
    })
  }

  function handleSavePrivileges() {
    const userId = createdUserId
    if (!userId) return
    setError(null)
    startTransition(async () => {
      const result = await saveExternalMemberPrivileges({
        userId,
        grants,
        scopes,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      handleOpenChange(false)
      router.refresh()
    })
  }

  function handleSkipPrivileges() {
    handleOpenChange(false)
    router.refresh()
  }

  const canSavePrivileges =
    Boolean(createdUserId) &&
    !isPending &&
    [...new Set(grants.map((g) => g.landingPagePublicId))].every((id) =>
      scopes.some(
        (scope) =>
          scope.landingPagePublicId === id && scope.utmSource.trim().length > 0
      )
    )

  const title =
    mode.kind === "edit"
      ? `Privileges — ${mode.memberName}`
      : step === "details"
        ? "Add external member"
        : "Set privileges"

  const description =
    mode.kind === "edit"
      ? "Choose projects, a UTM Source per project, then tabs and sections."
      : step === "details"
        ? "Create the account — login details are emailed to the collaborator automatically."
        : emailSent === false
          ? "Account created, but the credentials email failed to send. Share the password manually, or resend from Details later, then assign privileges."
          : "Credentials were emailed with name, email, and password. On first sign-in they scan an authenticator QR. Choose projects, UTM Sources, then tabs and sections."

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
          {!isEdit ? (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  step === "details"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600"
                )}
              >
                1. Details
              </span>
              <span className="text-muted-foreground">/</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  step === "privileges"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600"
                )}
              >
                2. Privileges
              </span>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {step === "details" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="external-first-name">First name</Label>
                  <Input
                    id="external-first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
                    autoComplete="given-name"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="external-last-name">Last name</Label>
                  <Input
                    id="external-last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="external-email">Email</Label>
                <Input
                  id="external-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="external-password">Password</Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      id="external-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-9 rounded-lg border-neutral-200 bg-white pr-10 shadow-xs"
                      autoComplete="new-password"
                      placeholder="At least 12 characters"
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-lg border-neutral-200 bg-white shadow-xs"
                    onClick={handleGeneratePassword}
                    disabled={isPending}
                  >
                    <RefreshCw className="size-3.5" />
                    Generate
                  </Button>
                </div>
              </div>
            </>
          ) : loadingPrivileges ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading privileges…
            </div>
          ) : (
            <ExternalPrivilegesEditor
              key={`${createdUserId ?? "new"}-${projects.length}`}
              projects={projects}
              grants={grants}
              onChange={setGrants}
              scopes={scopes}
              onScopesChange={setScopes}
              disabled={isPending}
            />
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-200 bg-white px-5 py-4 sm:px-6">
          {step === "details" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!canSubmitDetails}
                className="h-9 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Create & continue
              </Button>
            </>
          ) : (
            <>
              {!isEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipPrivileges}
                  disabled={isPending}
                  className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
                >
                  Skip for now
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isPending}
                  className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSavePrivileges}
                disabled={!canSavePrivileges}
                className="h-9 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Shield className="size-4" />
                )}
                Save privileges
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
