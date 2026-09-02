type LeadWithFields = {
  fields: Record<string, string>
}

export type VehicleModelCatalogRow = {
  year: number
  makeCode: string
  makeName: string
  modelCode: string
  modelName: string
}

export async function resolveVehicleNamesInLeads<T extends LeadWithFields>(
  leads: T[],
): Promise<T[]> {
  const { resolveVehicleNamesInLeadFields } = await import(
    '@workspace/database'
  )
  return resolveVehicleNamesInLeadFields(leads)
}

export function applyVehicleCatalogToLeads<T extends LeadWithFields>(
  leads: T[],
  catalog: VehicleModelCatalogRow[],
): T[] {
  const makeNames = new Map<string, string>()
  const modelNames = new Map<string, string>()
  for (const row of catalog) {
    const makeKey = `${row.year}|${row.makeCode.toUpperCase()}`
    makeNames.set(makeKey, row.makeName)
    modelNames.set(`${makeKey}|${row.modelCode}`, row.modelName)
  }

  return leads.map((lead) => {
    const entries = Object.entries(lead.fields)
    const keyByLower = new Map(
      entries.map(([key]) => [key.toLowerCase(), key]),
    )
    const fields = { ...lead.fields }
    let changed = false

    for (const [lowerKey, originalYearKey] of keyByLower) {
      const match = lowerKey.match(/^(car|vehicle)_(\d+)_year$/)
      if (!match) continue
      const prefix = `${match[1]}_${match[2]}`
      const makeKey = keyByLower.get(`${prefix}_make`)
      const modelKey = keyByLower.get(`${prefix}_model`)
      if (!makeKey) continue

      const year = Number(fields[originalYearKey])
      const rawMake = fields[makeKey]?.trim() ?? ''
      const catalogKey = `${year}|${rawMake.toUpperCase()}`
      const makeName = makeNames.get(catalogKey)
      if (makeName) {
        fields[makeKey] = makeName
        changed = true
      }

      if (modelKey) {
        const rawModel = fields[modelKey]?.trim() ?? ''
        const modelName = modelNames.get(`${catalogKey}|${rawModel}`)
        if (modelName) {
          fields[modelKey] = modelName
          changed = true
        }
      }
    }

    return changed ? { ...lead, fields } : lead
  })
}
