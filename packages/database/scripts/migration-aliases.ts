/**
 * Migrations renumbered in-repo after 0046_company_workspace landed.
 * Live `schema_migrations` rows may still use the old filenames.
 */
export const MIGRATION_ALIASES: Readonly<Record<string, string>> = {
  "0046_web_push.sql": "0047_web_push.sql",
  "0047_web_push_phase2.sql": "0048_web_push_phase2.sql",
  "0048_web_push_phase3.sql": "0049_web_push_phase3.sql",
}

export type MigrationAliasPlan =
  | { type: "rename"; from: string; to: string }
  | { type: "drop_obsolete"; id: string }

/**
 * Plan ledger fixes so applied history matches current drizzle filenames.
 * Does not re-run SQL — only reconciles schema_migrations ids.
 */
export function planMigrationAliasUpdates(
  appliedIds: Iterable<string>
): MigrationAliasPlan[] {
  const applied = new Set(appliedIds)
  const plans: MigrationAliasPlan[] = []

  for (const [oldId, newId] of Object.entries(MIGRATION_ALIASES)) {
    const hasOld = applied.has(oldId)
    const hasNew = applied.has(newId)
    if (hasOld && !hasNew) {
      plans.push({ type: "rename", from: oldId, to: newId })
      applied.delete(oldId)
      applied.add(newId)
    } else if (hasOld && hasNew) {
      plans.push({ type: "drop_obsolete", id: oldId })
      applied.delete(oldId)
    }
  }

  return plans
}

export function isMigrationApplied(
  file: string,
  appliedIds: ReadonlySet<string>
): boolean {
  if (appliedIds.has(file)) return true
  for (const [oldId, newId] of Object.entries(MIGRATION_ALIASES)) {
    if (newId === file && appliedIds.has(oldId)) return true
  }
  return false
}
