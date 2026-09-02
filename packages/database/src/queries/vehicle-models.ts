import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from '../index.js'
import { vehicleModels } from '../schema/vehicle-models.js'

type LeadWithFields = {
  fields: Record<string, string>
}

type Level2StatWithValue = {
  id: string
  value: string
}

type VehicleSelection = {
  year: number
  makeCode: string
}

const QUERY_PAIR_BATCH_SIZE = 75
const QUERY_CODE_BATCH_SIZE = 200

function vehicleCodesFromLeads(leads: LeadWithFields[]): {
  makeCodes: string[]
  modelCodes: string[]
} {
  const makeCodes = new Set<string>()
  const modelCodes = new Set<string>()
  for (const lead of leads) {
    for (const [key, rawValue] of Object.entries(lead.fields)) {
      const value = rawValue.trim()
      if (!value) continue
      if (/^(?:car|vehicle)_\d+_make$/i.test(key)) {
        makeCodes.add(value.toUpperCase())
      }
      if (/^(?:car|vehicle)_\d+_model$/i.test(key)) {
        modelCodes.add(value)
      }
    }
  }
  return { makeCodes: [...makeCodes], modelCodes: [...modelCodes] }
}

function selectionsFromLeads(
  leads: LeadWithFields[],
): Map<string, VehicleSelection> {
  const selections = new Map<string, VehicleSelection>()
  for (const lead of leads) {
    const fields = new Map(
      Object.entries(lead.fields).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    )
    for (const [key, rawYear] of fields) {
      const match = key.match(/^(car|vehicle)_(\d+)_year$/)
      if (!match) continue
      const year = Number(rawYear)
      const makeCode = (
        fields.get(`${match[1]}_${match[2]}_make`) ?? ''
      )
        .trim()
        .toUpperCase()
      if (!Number.isInteger(year) || !makeCode) continue
      selections.set(`${year}|${makeCode}`, { year, makeCode })
    }
  }
  return selections
}

export async function resolveVehicleNamesInLeadFields<
  T extends LeadWithFields,
>(leads: T[]): Promise<T[]> {
  const selections = [...selectionsFromLeads(leads).values()]
  const { makeCodes, modelCodes } = vehicleCodesFromLeads(leads)
  if (
    selections.length === 0 &&
    makeCodes.length === 0 &&
    modelCodes.length === 0
  ) {
    return leads
  }

  const makeNames = new Map<string, string>()
  const modelNames = new Map<string, string>()
  const makeNamesByCode = new Map<string, string>()
  const modelNameSetsByCode = new Map<string, Set<string>>()
  for (
    let index = 0;
    index < selections.length;
    index += QUERY_PAIR_BATCH_SIZE
  ) {
    const batch = selections.slice(index, index + QUERY_PAIR_BATCH_SIZE)
    const rows = await db
      .select({
        year: vehicleModels.year,
        makeCode: vehicleModels.makeCode,
        makeName: vehicleModels.makeName,
        modelCode: vehicleModels.modelCode,
        modelName: vehicleModels.modelName,
      })
      .from(vehicleModels)
      .where(
        or(
          ...batch.map((selection) =>
            and(
              eq(vehicleModels.year, selection.year),
              eq(vehicleModels.makeCode, selection.makeCode),
            ),
          ),
        ),
      )
    for (const row of rows) {
      const makeKey = `${row.year}|${row.makeCode.toUpperCase()}`
      makeNames.set(makeKey, row.makeName)
      modelNames.set(`${makeKey}|${row.modelCode}`, row.modelName)
    }
  }

  for (
    let index = 0;
    index < makeCodes.length;
    index += QUERY_CODE_BATCH_SIZE
  ) {
    const rows = await db
      .selectDistinct({
        makeCode: vehicleModels.makeCode,
        makeName: vehicleModels.makeName,
      })
      .from(vehicleModels)
      .where(
        inArray(
          vehicleModels.makeCode,
          makeCodes.slice(index, index + QUERY_CODE_BATCH_SIZE),
        ),
      )
    for (const row of rows) {
      makeNamesByCode.set(row.makeCode.toUpperCase(), row.makeName)
    }
  }

  for (
    let index = 0;
    index < modelCodes.length;
    index += QUERY_CODE_BATCH_SIZE
  ) {
    const rows = await db
      .selectDistinct({
        modelCode: vehicleModels.modelCode,
        modelName: vehicleModels.modelName,
      })
      .from(vehicleModels)
      .where(
        inArray(
          vehicleModels.modelCode,
          modelCodes.slice(index, index + QUERY_CODE_BATCH_SIZE),
        ),
      )
    for (const row of rows) {
      const names = modelNameSetsByCode.get(row.modelCode) ?? new Set<string>()
      names.add(row.modelName)
      modelNameSetsByCode.set(row.modelCode, names)
    }
  }
  const uniqueModelNamesByCode = new Map<string, string>()
  for (const [code, names] of modelNameSetsByCode) {
    if (names.size === 1) uniqueModelNamesByCode.set(code, [...names][0]!)
  }

  return leads.map((lead) => {
    const keyByLower = new Map(
      Object.keys(lead.fields).map((key) => [key.toLowerCase(), key]),
    )
    const fields = { ...lead.fields }
    let changed = false

    for (const [lowerKey, yearKey] of keyByLower) {
      const match = lowerKey.match(/^(car|vehicle)_(\d+)_year$/)
      if (!match) continue
      const prefix = `${match[1]}_${match[2]}`
      const makeKey = keyByLower.get(`${prefix}_make`)
      const modelKey = keyByLower.get(`${prefix}_model`)
      if (!makeKey) continue

      const lookupKey = `${Number(fields[yearKey])}|${(fields[makeKey] ?? '')
        .trim()
        .toUpperCase()}`
      const makeName =
        makeNames.get(lookupKey) ??
        makeNamesByCode.get((fields[makeKey] ?? '').trim().toUpperCase())
      if (makeName) {
        fields[makeKey] = makeName
        changed = true
      }
      if (modelKey) {
        const modelCode = (fields[modelKey] ?? '').trim()
        const modelName =
          modelNames.get(`${lookupKey}|${modelCode}`) ??
          uniqueModelNamesByCode.get(modelCode)
        if (modelName) {
          fields[modelKey] = modelName
          changed = true
        }
      }
    }

    for (const [lowerKey, originalKey] of keyByLower) {
      const rawValue = lead.fields[originalKey]?.trim() ?? ''
      if (!rawValue) continue
      if (/^(?:car|vehicle)_\d+_make$/.test(lowerKey)) {
        const makeName = makeNamesByCode.get(rawValue.toUpperCase())
        if (makeName && fields[originalKey] === rawValue) {
          fields[originalKey] = makeName
          changed = true
        }
      }
      if (/^(?:car|vehicle)_\d+_model$/.test(lowerKey)) {
        const modelName = uniqueModelNamesByCode.get(rawValue)
        if (modelName && fields[originalKey] === rawValue) {
          fields[originalKey] = modelName
          changed = true
        }
      }
    }

    return changed ? { ...lead, fields } : lead
  })
}

export async function resolveVehicleNamesInLevel2Stats<
  T extends Level2StatWithValue,
>(stats: T[]): Promise<T[]> {
  const makeCodes = new Set<string>()
  const modelCodes = new Set<string>()
  for (const stat of stats) {
    const value = stat.value.trim()
    if (!value || value === '—') continue
    if (/^best-(?:car|vehicle)-\d+-make$/.test(stat.id)) {
      makeCodes.add(value.toUpperCase())
    }
    if (/^best-(?:car|vehicle)-\d+-model$/.test(stat.id)) {
      modelCodes.add(value)
    }
  }
  if (makeCodes.size === 0 && modelCodes.size === 0) return stats

  const makeNames = new Map<string, Set<string>>()
  if (makeCodes.size > 0) {
    const rows = await db
      .selectDistinct({
        code: vehicleModels.makeCode,
        name: vehicleModels.makeName,
      })
      .from(vehicleModels)
      .where(inArray(vehicleModels.makeCode, [...makeCodes]))
    for (const row of rows) {
      const names = makeNames.get(row.code.toUpperCase()) ?? new Set<string>()
      names.add(row.name)
      makeNames.set(row.code.toUpperCase(), names)
    }
  }

  const modelNames = new Map<string, Set<string>>()
  if (modelCodes.size > 0) {
    const rows = await db
      .selectDistinct({
        code: vehicleModels.modelCode,
        name: vehicleModels.modelName,
      })
      .from(vehicleModels)
      .where(inArray(vehicleModels.modelCode, [...modelCodes]))
    for (const row of rows) {
      const names = modelNames.get(row.code) ?? new Set<string>()
      names.add(row.name)
      modelNames.set(row.code, names)
    }
  }

  return stats.map((stat) => {
    const value = stat.value.trim()
    const names = /^best-(?:car|vehicle)-\d+-make$/.test(stat.id)
      ? makeNames.get(value.toUpperCase())
      : /^best-(?:car|vehicle)-\d+-model$/.test(stat.id)
        ? modelNames.get(value)
        : undefined
    return names?.size === 1 ? { ...stat, value: [...names][0]! } : stat
  })
}
