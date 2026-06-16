import { notFound } from "next/navigation"
import type { ProfileData } from "@/features/profile/model/profile"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

export async function loadProfileData(): Promise<ProfileData> {
  const user = await requireLandingPageActor()
  if (!user) notFound()

  return {
    firstName: user.firstName?.trim() ?? "",
    lastName: user.lastName?.trim() ?? "",
    email: user.email ?? "",
    role: user.role?.trim() ?? "",
    image: user.image,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    isTwoFactorEnabled: user.isTwoFactorEnabled ?? false,
    hasPassword: Boolean(user.password),
  }
}
