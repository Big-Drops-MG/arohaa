import { Suspense } from "react"
import { AcceptExternalInvite } from "@/features/auth/view/AcceptExternalInvite"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Accept invite")

export default function AcceptExternalInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptExternalInvite />
    </Suspense>
  )
}
