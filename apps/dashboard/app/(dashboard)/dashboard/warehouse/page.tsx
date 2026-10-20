import { WarehouseDashboard } from "@/features/warehouse/view/WarehouseDashboard"
import { canReviewWarehouseLeads } from "@/lib/server/actor-can"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { loadWarehouseDashboardData } from "@/lib/server/warehouse-load"
import { redirect } from "next/navigation"

export default async function WarehousePage() {
  const actor = await requireLandingPageActor()
  if (!actor) redirect("/login")
  if (!(await canReviewWarehouseLeads(actor))) redirect("/dashboard")

  const data = await loadWarehouseDashboardData()

  return <WarehouseDashboard data={data} />
}
