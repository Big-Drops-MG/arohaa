import { db, sql, vehicleModels } from '../src/index.js'

const API_BASE = 'https://api2.smartfinancial.com/api/v1/vehicle'
const START_YEAR = 1988
const END_YEAR = 2027
const REQUEST_CONCURRENCY = 6
const UPSERT_BATCH_SIZE = 500

type VehicleMake = {
  name: string
  code: string
}

type VehicleModel = {
  name: string
  code: string
}

type MakesResponse = {
  makes?: VehicleMake[]
}

type ModelsResponse = {
  models?: VehicleModel[]
}

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })

  if (response.ok) return (await response.json()) as T

  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    return fetchJson<T>(url, attempt + 1)
  }

  throw new Error(`${response.status} ${response.statusText}: ${url}`)
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index]!)
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      async () => worker(),
    ),
  )
  return results
}

async function fetchMakes(year: number): Promise<VehicleMake[]> {
  const url = `${API_BASE}/makes?year=${year}`
  const payload = await fetchJson<MakesResponse>(url)
  return (payload.makes ?? []).filter(
    (make) => make.code?.trim() && make.name?.trim(),
  )
}

async function fetchModels(
  year: number,
  make: VehicleMake,
): Promise<VehicleModel[]> {
  const params = new URLSearchParams({
    year: String(year),
    make: make.code,
  })
  const payload = await fetchJson<ModelsResponse>(
    `${API_BASE}/models?${params.toString()}`,
  )
  return (payload.models ?? []).filter(
    (model) => model.code?.trim() && model.name?.trim(),
  )
}

async function upsertYear(year: number): Promise<number> {
  const makes = await fetchMakes(year)
  const modelsByMake = await mapWithConcurrency(
    makes,
    REQUEST_CONCURRENCY,
    async (make) => ({
      make,
      models: await fetchModels(year, make),
    }),
  )

  const rowsByKey = new Map<
    string,
    {
      year: number
      makeCode: string
      makeName: string
      modelCode: string
      modelName: string
      updatedAt: Date
    }
  >()
  for (const { make, models } of modelsByMake) {
    const makeCode = make.code.trim().toUpperCase()
    for (const model of models) {
      const modelCode = model.code.trim()
      rowsByKey.set(`${makeCode}|${modelCode}`, {
        year,
        makeCode,
        makeName: make.name.trim(),
        modelCode,
        modelName: model.name.trim(),
        updatedAt: new Date(),
      })
    }
  }
  const rows = [...rowsByKey.values()]

  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE)
    await db
      .insert(vehicleModels)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          vehicleModels.year,
          vehicleModels.makeCode,
          vehicleModels.modelCode,
        ],
        set: {
          makeName: sql`excluded."makeName"`,
          modelName: sql`excluded."modelName"`,
          updatedAt: new Date(),
        },
      })
  }

  return rows.length
}

async function main(): Promise<void> {
  let total = 0
  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    const count = await upsertYear(year)
    total += count
    console.log(`${year}: synced ${count.toLocaleString()} models`)
  }
  console.log(`Vehicle model sync complete: ${total.toLocaleString()} rows`)
}

main().catch((error) => {
  console.error('Vehicle model sync failed', error)
  process.exit(1)
})
