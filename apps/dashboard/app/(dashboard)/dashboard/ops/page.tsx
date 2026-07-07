import { OpsDashboard } from "@/features/ops/view/OpsDashboard"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { loadOpsDashboardData } from "@/lib/server/ops-dashboard-load"
import { redirect } from "next/navigation"

export default async function OpsPage() {
  const actor = await requireLandingPageActor()
  if (!actor) redirect("/login")

  const data = await loadOpsDashboardData()

  return <OpsDashboard data={data} />
}
