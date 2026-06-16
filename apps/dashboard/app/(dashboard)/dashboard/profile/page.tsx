import { ProfileDashboard } from "@/features/profile/view/ProfileDashboard"
import { loadProfileData } from "@/lib/server/profile-load"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Profile")

export default async function ProfilePage() {
  const profile = await loadProfileData()

  return <ProfileDashboard profile={profile} />
}
