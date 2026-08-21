"use server"

import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { generateSecret } from "otplib"
import { desc, eq, isNull } from "drizzle-orm"
import {
  db,
  landingPages,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"
import {
  EXTERNAL_PRIVILEGE_TABS,
  isExternalTeamKind,
  type ExternalPrivilegeGrant,
  type ExternalProjectScope,
} from "@/features/team/model/external-privileges"
import { isFullAccessLevel } from "@/features/team/model/access-level"
import { isApprovedAccess } from "@/lib/server/access-status"
import {
  assertExternalTarget,
  loadExternalPrivileges,
  loadExternalProjectScopes,
  replaceExternalPrivileges,
} from "@/lib/server/external-access"
import {
  sendExternalMemberAccessEmail,
  sendExternalMemberInviteEmail,
} from "@/lib/server/email/send-external-invite-email"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { ensureRoleExists } from "@/lib/server/roles"
import type { ExternalMemberAccessProject } from "@/emails/templates"

const MIN_PASSWORD_LENGTH = 12

function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH
}

const allowedTabValues = new Set(
  EXTERNAL_PRIVILEGE_TABS.map((tab) => tab.value)
)

function sanitizeGrants(
  grants: ExternalPrivilegeGrant[]
): ExternalPrivilegeGrant[] {
  const cleaned: ExternalPrivilegeGrant[] = []
  const seen = new Set<string>()

  for (const grant of grants) {
    const publicId = grant.landingPagePublicId?.trim()
    const tab = grant.tab
    const section = (grant.section ?? "").trim()
    if (!publicId || !allowedTabValues.has(tab)) continue

    const tabDef = EXTERNAL_PRIVILEGE_TABS.find((t) => t.value === tab)
    if (!tabDef) continue

    if (tabDef.sections.length > 0) {
      if (!section || !tabDef.sections.some((s) => s.id === section)) continue
    } else if (section) {
      continue
    }

    const key = `${publicId}::${tab}::${section}`
    if (seen.has(key)) continue
    seen.add(key)
    cleaned.push({
      landingPagePublicId: publicId,
      tab,
      section,
    })
  }

  return cleaned
}

const EXTERNAL_MEMBER_ROLE = "Partner"

function canManageTeam(actor: {
  accessStatus: string | null
  teamKind: string | null
  accessLevel: string | null
}): boolean {
  return (
    isApprovedAccess(actor.accessStatus) &&
    !isExternalTeamKind(actor.teamKind) &&
    isFullAccessLevel(actor.accessLevel)
  )
}

export async function createExternalTeamMember(input: {
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<{
  error?: string
  success?: true
  userId?: string
  emailSent?: boolean
}> {
  const actor = await requireLandingPageActor()
  if (!actor || !canManageTeam(actor)) {
    return { error: "Unauthorized." }
  }

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = normalizeUserEmail(input.email)
  const password = input.password

  if (!firstName || !lastName || !email || !password) {
    return {
      error: "First name, last name, email, and password are required.",
    }
  }

  if (!email.includes("@")) {
    return { error: "Enter a valid email address." }
  }

  if (!isValidPassword(password)) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    }
  }

  const existing = await db.query.users.findFirst({
    where: whereUserEmail(email),
  })
  if (existing) {
    const canReplaceRejectedExternal =
      isExternalTeamKind(existing.teamKind) &&
      existing.accessStatus === "rejected"
    if (!canReplaceRejectedExternal) {
      return { error: "A team member with this email already exists." }
    }
    await replaceExternalPrivileges(existing.id, [], [])
    await db.delete(users).where(eq(users.id, existing.id))
  }

  let savedRole: string
  try {
    savedRole = await ensureRoleExists(EXTERNAL_MEMBER_ROLE)
  } catch {
    return { error: "Could not save role. Please try again." }
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const twoFactorSecret = generateSecret()
  const now = new Date()

  const inserted = await db
    .insert(users)
    .values({
      firstName,
      lastName,
      email,
      role: savedRole,
      password: passwordHash,
      accessStatus: "approved",
      accessReviewedAt: now,
      accessReviewedByUserId: actor.id,
      teamKind: "external",
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: twoFactorSecret,
    })
    .returning({ id: users.id })

  const userId = inserted[0]?.id
  if (!userId) {
    return { error: "Could not create member. Please try again." }
  }

  const emailResult = await sendExternalMemberInviteEmail({
    to: email,
    recipientFirstName: firstName,
    recipientLastName: lastName,
    password,
  })

  revalidatePath("/dashboard/team")
  return {
    success: true,
    userId,
    emailSent: Boolean(emailResult),
  }
}

export async function saveExternalMemberPrivileges(input: {
  userId: string
  grants: ExternalPrivilegeGrant[]
  scopes?: ExternalProjectScope[]
}): Promise<{ error?: string; success?: true; accessEmailSent?: boolean }> {
  const actor = await requireLandingPageActor()
  if (!actor || !canManageTeam(actor)) {
    return { error: "Unauthorized." }
  }

  const target = await assertExternalTarget(input.userId)
  if (!target) {
    return { error: "External member not found." }
  }

  const grants = sanitizeGrants(input.grants)
  const scopes = (input.scopes ?? [])
    .map((scope) => ({
      landingPagePublicId: scope.landingPagePublicId.trim(),
      utmSource: scope.utmSource.trim(),
    }))
    .filter((scope) => scope.landingPagePublicId && scope.utmSource)

  const projectIds = [...new Set(grants.map((g) => g.landingPagePublicId))]
  if (projectIds.length > 0) {
    const existingProjects = await db
      .select({ publicId: landingPages.publicId })
      .from(landingPages)
      .where(isNull(landingPages.deletedAt))

    const validIds = new Set(existingProjects.map((p) => p.publicId))
    for (const id of projectIds) {
      if (!validIds.has(id)) {
        return { error: "One or more selected projects are invalid." }
      }
    }

    const scopedProjects = new Set(
      scopes.map((scope) => scope.landingPagePublicId)
    )
    for (const id of projectIds) {
      if (!scopedProjects.has(id)) {
        return {
          error:
            "Select at least one UTM Source for every project that has tabs enabled.",
        }
      }
    }
  }

  // Keep scopes only for projects that still have grants.
  const grantProjectIds = new Set(projectIds)
  const scopesForGrants = scopes.filter((scope) =>
    grantProjectIds.has(scope.landingPagePublicId)
  )

  await replaceExternalPrivileges(input.userId, grants, scopesForGrants)

  const projects = await db
    .select({
      publicId: landingPages.publicId,
      brandName: landingPages.brandName,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))

  const brandById = new Map(projects.map((p) => [p.publicId, p.brandName]))
  const utmByProject = new Map<string, string[]>()
  for (const scope of scopesForGrants) {
    const list = utmByProject.get(scope.landingPagePublicId) ?? []
    if (!list.includes(scope.utmSource)) list.push(scope.utmSource)
    utmByProject.set(scope.landingPagePublicId, list)
  }

  const accessProjects: ExternalMemberAccessProject[] = []
  for (const publicId of projectIds) {
    const tabLabels = new Set<string>()
    for (const grant of grants) {
      if (grant.landingPagePublicId !== publicId) continue
      const tabDef = EXTERNAL_PRIVILEGE_TABS.find((t) => t.value === grant.tab)
      if (tabDef) tabLabels.add(tabDef.label)
    }
    accessProjects.push({
      brandName: brandById.get(publicId) ?? publicId,
      utmSources: (utmByProject.get(publicId) ?? []).sort((a, b) =>
        a.localeCompare(b)
      ),
      tabs: [...tabLabels],
    })
  }
  accessProjects.sort((a, b) => a.brandName.localeCompare(b.brandName))

  let accessEmailSent = false
  if (target.email) {
    const accessEmailResult = await sendExternalMemberAccessEmail({
      to: target.email,
      recipientFirstName: target.firstName ?? undefined,
      projects: accessProjects,
    })
    accessEmailSent = Boolean(accessEmailResult)
  }

  revalidatePath("/dashboard/team")
  return {
    success: true,
    accessEmailSent,
  }
}

function generateInvitePassword(length = 20): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*"
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]!).join("")
}

/**
 * Reset credentials for an external member and email the new details.
 */
export async function resendExternalMemberInvite(
  userId: string
): Promise<{ error?: string; success?: true; emailSent?: boolean }> {
  const actor = await requireLandingPageActor()
  if (!actor || !canManageTeam(actor)) {
    return { error: "Unauthorized." }
  }

  const target = await assertExternalTarget(userId)
  if (!target || !isApprovedAccess(target.accessStatus)) {
    return { error: "External member not found." }
  }
  if (!target.email) {
    return { error: "This member has no email address." }
  }

  const password = generateInvitePassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const twoFactorSecret = generateSecret()

  await db
    .update(users)
    .set({
      password: passwordHash,
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: twoFactorSecret,
    })
    .where(eq(users.id, userId))

  const emailResult = await sendExternalMemberInviteEmail({
    to: target.email,
    recipientFirstName: target.firstName ?? undefined,
    recipientLastName: target.lastName ?? undefined,
    password,
  })

  if (!emailResult) {
    return {
      error:
        "Credentials were reset, but the email failed to send. Try again in a moment.",
    }
  }

  revalidatePath("/dashboard/team")
  return { success: true, emailSent: true }
}

export async function getExternalMemberPrivileges(userId: string): Promise<{
  error?: string
  grants?: ExternalPrivilegeGrant[]
  scopes?: ExternalProjectScope[]
}> {
  const actor = await requireLandingPageActor()
  if (!actor || !canManageTeam(actor)) {
    return { error: "Unauthorized." }
  }

  const target = await assertExternalTarget(userId)
  if (!target) {
    return { error: "External member not found." }
  }

  const [grants, scopes] = await Promise.all([
    loadExternalPrivileges(userId),
    loadExternalProjectScopes(userId),
  ])
  return { grants, scopes }
}

export async function listProjectsForPrivileges(): Promise<{
  error?: string
  projects?: { publicId: string; brandName: string }[]
}> {
  const actor = await requireLandingPageActor()
  if (!actor || !canManageTeam(actor)) {
    return { error: "Unauthorized." }
  }

  const projects = await db
    .select({
      publicId: landingPages.publicId,
      brandName: landingPages.brandName,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))

  return { projects }
}

/**
 * Permanently remove an external partner: delete privileges/scopes and the
 * user row so they cannot sign in and the email can be invited again.
 */
export async function removeExternalTeamMember(
  userId: string
): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (!actor || !canManageTeam(actor)) {
    return { error: "Unauthorized." }
  }

  if (actor.id === userId) {
    return { error: "You cannot remove your own account." }
  }

  const target = await assertExternalTarget(userId)
  if (!target || !isApprovedAccess(target.accessStatus)) {
    return { error: "External member not found." }
  }

  await replaceExternalPrivileges(userId, [], [])
  await db.delete(users).where(eq(users.id, userId))

  revalidatePath("/dashboard/team")
  return { success: true }
}
