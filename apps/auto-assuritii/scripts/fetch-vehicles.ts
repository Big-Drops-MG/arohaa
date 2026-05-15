import "../lib/load-env.js"
import axios from "axios"
import { db } from "../lib/db/index.js"
import { vehicleYears, vehicleMakes, vehicleModels } from "../lib/db/schema.js"

const API_BASE = "https://leadsubmission.enduranceapi.com/api/v2/vehicle/"

const MAX_RETRIES = 3
const INITIAL_DELAY = 1000
const MAX_CONCURRENT_REQUESTS = 5
const BATCH_SIZE = 50

interface Year {
  id: number
  name: string
}

interface Make {
  id: number
  name: string
}

interface Model {
  id: number
  name: string
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === retries) throw error

      const isRateLimitError =
        axios.isAxiosError(error) &&
        (error.response?.status === 429 || error.response?.status === 503)

      const delay = isRateLimitError
        ? INITIAL_DELAY * Math.pow(2, attempt)
        : INITIAL_DELAY * attempt

      console.warn(
        `  ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`
      )
      await sleep(delay)
    }
  }
  throw new Error("Max retries reached")
}

async function fetchYears(): Promise<Year[]> {
  const response = await axios.get<Year[]>(`${API_BASE}years`)
  return response.data.filter((y) => y.id !== 0 && y.name !== "0")
}

async function fetchMakes(apiYearId: number): Promise<Make[]> {
  const response = await axios.get<Make[]>(
    `${API_BASE}makes?vehicleYearId=${apiYearId}`
  )
  return response.data
}

async function fetchModels(makeId: number): Promise<Model[]> {
  const response = await axios.get<Model[]>(
    `${API_BASE}models?vehicleMakeId=${makeId}`
  )
  return response.data
}

async function insertYearsBatch(
  years: Year[]
): Promise<Map<number, number>> {
  const apiYearIdToDbId = new Map<number, number>()

  const validYears = years.filter((y) => {
    const yearNum = parseInt(y.name, 10)
    return !Number.isNaN(yearNum) && yearNum > 0
  })

  for (const batch of chunk(validYears, BATCH_SIZE)) {
    const inserted = await db
      .insert(vehicleYears)
      .values(
        batch.map((y) => ({
          apiYearId: y.id,
          year: parseInt(y.name, 10),
        }))
      )
      .onConflictDoUpdate({
        target: vehicleYears.apiYearId,
        set: { year: vehicleYears.year },
      })
      .returning()

    for (const row of inserted) {
      apiYearIdToDbId.set(row.apiYearId, row.id)
    }
  }

  return apiYearIdToDbId
}

async function insertMakesBatch(
  makes: Array<{ make: Make; yearDbId: number }>
): Promise<Map<number, number>> {
  const makeMap = new Map<number, number>()

  for (const batch of chunk(makes, BATCH_SIZE)) {
    const inserted = await db
      .insert(vehicleMakes)
      .values(
        batch.map(({ make, yearDbId }) => ({
          makeId: make.id,
          name: make.name,
          yearId: yearDbId,
        }))
      )
      .onConflictDoUpdate({
        target: vehicleMakes.makeId,
        set: { name: vehicleMakes.name },
      })
      .returning()

    for (const row of inserted) {
      makeMap.set(row.makeId, row.id)
    }
  }

  return makeMap
}

async function insertModelsBatch(
  models: Array<{ model: Model; makeDbId: number }>
): Promise<void> {
  for (const batch of chunk(models, BATCH_SIZE)) {
    await db
      .insert(vehicleModels)
      .values(
        batch.map(({ model, makeDbId }) => ({
          modelId: model.id,
          name: model.name,
          makeId: makeDbId,
        }))
      )
      .onConflictDoNothing()
  }
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

async function processConcurrently<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = fn(item).then((result) => {
      results.push(result)
      executing.splice(executing.indexOf(promise), 1)
    })

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}

async function main() {
  console.log("🚗 Starting vehicle data fetch...")

  try {
    const years = await fetchWithRetry(fetchYears)
    console.log(`📅 Fetched ${years.length} years from API`)

    console.log("💾 Inserting years in batch...")
    const apiYearIdToDbId = await insertYearsBatch(years)
    console.log(`✅ Inserted ${apiYearIdToDbId.size} years`)

    let totalMakes = 0
    let totalModels = 0

    for (const year of years) {
      const yearNum = parseInt(year.name, 10)
      if (Number.isNaN(yearNum) || yearNum <= 0) continue

      console.log(`\n📆 Processing year: ${year.name} (API id: ${year.id})`)
      const yearDbId = apiYearIdToDbId.get(year.id)
      if (!yearDbId) {
        console.error(`❌ Year ${year.name} (API id ${year.id}) not found in database`)
        continue
      }

      const makes = await fetchWithRetry(() => fetchMakes(year.id))
      console.log(`  → Found ${makes.length} makes`)

      if (makes.length === 0) continue

      const makesWithYear = makes.map((make) => ({ make, yearDbId }))
      const makeMap = await insertMakesBatch(makesWithYear)
      totalMakes += makes.length

      const modelsToInsert: Array<{ model: Model; makeDbId: number }> = []

      await processConcurrently(
        makes,
        async (make) => {
          const makeDbId = makeMap.get(make.id)
          if (!makeDbId) {
            console.error(`❌ Make ${make.name} (${make.id}) not found in database`)
            return
          }

          const models = await fetchWithRetry(() => fetchModels(make.id))
          console.log(`    → ${make.name}: ${models.length} models`)

          for (const model of models) {
            modelsToInsert.push({ model, makeDbId })
          }
        },
        MAX_CONCURRENT_REQUESTS
      )

      if (modelsToInsert.length > 0) {
        await insertModelsBatch(modelsToInsert)
        totalModels += modelsToInsert.length
        console.log(`  ✅ Inserted ${modelsToInsert.length} models for year ${year.name}`)
      }
    }

    console.log("\n🎉 All data fetched and stored successfully!")
    console.log(`📊 Summary:`)
    console.log(`   Years: ${apiYearIdToDbId.size}`)
    console.log(`   Makes: ${totalMakes}`)
    console.log(`   Models: ${totalModels}`)

    process.exit(0)
  } catch (error) {
    console.error("\n❌ Error:", error)
    if (axios.isAxiosError(error)) {
      console.error("API Error:", {
        status: error.response?.status,
        data: error.response?.data,
      })
    }
    process.exit(1)
  }
}

main()
