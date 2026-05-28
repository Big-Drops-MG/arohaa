class FakeStorage {
  private map = new Map<string, string>()
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
  get length() {
    return this.map.size
  }
  key(_i: number) {
    return null
  }
  raw() {
    return Object.fromEntries(this.map)
  }
}

interface FakeListenerEntry {
  type: string
  fn: (e?: unknown) => void
}

class FakeWindow {
  listeners: FakeListenerEntry[] = []
  addEventListener(type: string, fn: (e?: unknown) => void) {
    this.listeners.push({ type, fn })
  }
  dispatch(type: string) {
    for (const l of this.listeners) if (l.type === type) l.fn()
  }
}

class FakeDocument {
  visibilityState: "visible" | "hidden" = "visible"
  listeners: FakeListenerEntry[] = []
  addEventListener(type: string, fn: (e?: unknown) => void) {
    this.listeners.push({ type, fn })
  }
  dispatch(type: string) {
    for (const l of this.listeners) if (l.type === type) l.fn()
  }
}

const storage = new FakeStorage()
const win = new FakeWindow()
const doc = new FakeDocument()

function defineGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

defineGlobal("localStorage", storage)
defineGlobal("window", win)
defineGlobal("document", doc)
defineGlobal("navigator", { onLine: true })

const retry = await import("../packages/sdk/src/network/retry.ts")
const { saveToOutbox, drainOutbox, getOutboxSize, setupOutboxDrainTriggers, __retryInternals } = retry
type SendOutcome = "ok" | "transient" | "permanent"

function makePayload(ev: string, props: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    wid: "11111111-1111-4111-8111-111111111111",
    uid: "test-uid",
    sid: "test-sid",
    fp: "abcd1234",
    ev,
    ts: Date.now(),
    url: "https://example.com",
    page: "",
    variant: "",
    formtype: "single",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    referrer: "",
    metric_name: "",
    metric_value: 0,
    props,
  }
}

function reset() {
  storage.clear()
  win.listeners = []
  doc.listeners = []
  doc.visibilityState = "visible"
  defineGlobal("navigator", { onLine: true })
}

interface CaseResult {
  name: string
  passed: boolean
  detail: string
}
const results: CaseResult[] = []

function expect(cond: boolean, name: string, detail: string) {
  results.push({ name, passed: cond, detail })
  console.log(`  ${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`)
}

console.log("=== 1. saveToOutbox: persists payload with envelope (savedAt + attempts=0) ===")
reset()
const p1 = makePayload("offline_click")
saveToOutbox(p1 as never)
const stored1 = JSON.parse(storage.getItem(__retryInternals.OUTBOX_KEY)!) as Array<{
  payload: { ev: string }
  savedAt: number
  attempts: number
}>
expect(stored1.length === 1, "one entry stored", `got ${stored1.length}`)
expect(stored1[0]!.payload.ev === "offline_click", "payload preserved", JSON.stringify(stored1[0]))
expect(stored1[0]!.attempts === 0, "initial attempts is 0", `got ${stored1[0]!.attempts}`)
expect(typeof stored1[0]!.savedAt === "number" && stored1[0]!.savedAt > 0, "savedAt is a timestamp", String(stored1[0]!.savedAt))

console.log("\n=== 2. saveToOutbox: caps queue at MAX_OUTBOX_SIZE (drops oldest) ===")
reset()
for (let i = 0; i < __retryInternals.MAX_OUTBOX_SIZE + 5; i++) {
  saveToOutbox(makePayload(`evt_${i}`) as never)
}
const stored2 = JSON.parse(storage.getItem(__retryInternals.OUTBOX_KEY)!) as Array<{ payload: { ev: string } }>
expect(stored2.length === __retryInternals.MAX_OUTBOX_SIZE, "capped at MAX_OUTBOX_SIZE", `got ${stored2.length}`)
expect(stored2[0]!.payload.ev === "evt_5", "oldest 5 evicted (FIFO)", `first is ${stored2[0]!.payload.ev}`)
expect(
  stored2[stored2.length - 1]!.payload.ev === `evt_${__retryInternals.MAX_OUTBOX_SIZE + 4}`,
  "newest preserved at tail",
  `last is ${stored2[stored2.length - 1]!.payload.ev}`,
)

console.log("\n=== 3. drainOutbox: ok outcome removes entry ===")
reset()
saveToOutbox(makePayload("a") as never)
saveToOutbox(makePayload("b") as never)
const seenA: string[] = []
const drainA = await drainOutbox(async (p) => {
  seenA.push((p as { ev: string }).ev)
  return "ok"
})
expect(drainA.delivered === 2, "delivered both", JSON.stringify(drainA))
expect(drainA.remaining === 0, "outbox empty", JSON.stringify(drainA))
expect(seenA.join(",") === "a,b", "delivered in FIFO order", seenA.join(","))

console.log("\n=== 4. drainOutbox: permanent outcome drops without retry ===")
reset()
saveToOutbox(makePayload("poison") as never)
const drainB = await drainOutbox(async () => "permanent")
expect(drainB.dropped === 1, "dropped 1", JSON.stringify(drainB))
expect(drainB.remaining === 0, "outbox empty after permanent drop", JSON.stringify(drainB))

console.log("\n=== 5. drainOutbox: transient outcome re-queues with attempts++ ===")
reset()
saveToOutbox(makePayload("flaky") as never)
const drainC1 = await drainOutbox(async () => "transient")
expect(drainC1.remaining === 1, "still in outbox after transient", JSON.stringify(drainC1))
const stored5 = JSON.parse(storage.getItem(__retryInternals.OUTBOX_KEY)!) as Array<{ attempts: number }>
expect(stored5[0]!.attempts === 1, "attempts incremented to 1", String(stored5[0]?.attempts))

console.log("\n=== 6. drainOutbox: drops after MAX_ATTEMPTS transient failures ===")
reset()
saveToOutbox(makePayload("forever_flaky") as never)
let totalAttempted = 0
for (let i = 0; i < __retryInternals.MAX_ATTEMPTS + 1; i++) {
  const r = await drainOutbox(async () => "transient")
  totalAttempted += r.attempted
}
expect(getOutboxSize() === 0, "dropped after max attempts", `size ${getOutboxSize()}`)
expect(totalAttempted === __retryInternals.MAX_ATTEMPTS, "tried exactly MAX_ATTEMPTS times", `got ${totalAttempted}`)

console.log("\n=== 7. drainOutbox: thrown sender treated as transient ===")
reset()
saveToOutbox(makePayload("thrower") as never)
const drainD = await drainOutbox(async () => {
  throw new Error("network gone")
})
expect(drainD.remaining === 1, "thrown error keeps event in queue", JSON.stringify(drainD))

console.log("\n=== 8. drainOutbox: skips when navigator.onLine === false ===")
reset()
saveToOutbox(makePayload("offline") as never)
defineGlobal("navigator", { onLine: false })
let calledOffline = false
const drainE = await drainOutbox(async () => {
  calledOffline = true
  return "ok"
})
expect(!calledOffline, "send not called when offline", `called=${calledOffline}`)
expect(drainE.attempted === 0, "no attempts while offline", JSON.stringify(drainE))
expect(getOutboxSize() === 1, "event preserved", String(getOutboxSize()))
defineGlobal("navigator", { onLine: true })

console.log("\n=== 9. drainOutbox: respects DRAIN_BATCH_SIZE per call ===")
reset()
const batch = __retryInternals.DRAIN_BATCH_SIZE
for (let i = 0; i < batch + 5; i++) {
  saveToOutbox(makePayload(`b_${i}`) as never)
}
const drainF = await drainOutbox(async () => "ok")
expect(drainF.delivered === batch, `delivered exactly ${batch}`, JSON.stringify(drainF))
expect(drainF.remaining === 5, "5 still pending", JSON.stringify(drainF))

console.log("\n=== 10. drainOutbox: drainInFlight lock prevents concurrent drains ===")
reset()
saveToOutbox(makePayload("concurrent") as never)
let inflightCount = 0
let maxInflight = 0
const slowSender = async (): Promise<SendOutcome> => {
  inflightCount++
  if (inflightCount > maxInflight) maxInflight = inflightCount
  await new Promise((r) => setTimeout(r, 50))
  inflightCount--
  return "ok"
}
const [a, b] = await Promise.all([drainOutbox(slowSender), drainOutbox(slowSender)])
const totalDelivered = a.delivered + b.delivered
expect(maxInflight === 1, "drains never run concurrently", `max parallel=${maxInflight}`)
expect(totalDelivered === 1, "single event delivered exactly once", `got ${totalDelivered}`)

console.log("\n=== 11. saveToOutbox: prunes expired entries (> MAX_AGE_MS) ===")
reset()
const ancient = {
  payload: makePayload("ancient"),
  savedAt: Date.now() - __retryInternals.MAX_AGE_MS - 1000,
  attempts: 0,
}
const fresh = { payload: makePayload("fresh"), savedAt: Date.now(), attempts: 0 }
storage.setItem(__retryInternals.OUTBOX_KEY, JSON.stringify([ancient, fresh]))
expect(getOutboxSize() === 1, "expired entries hidden from size", String(getOutboxSize()))
saveToOutbox(makePayload("brand_new") as never)
const stored11 = JSON.parse(storage.getItem(__retryInternals.OUTBOX_KEY)!) as Array<{
  payload: { ev: string }
}>
expect(stored11.length === 2, "ancient pruned during save", String(stored11.length))
expect(
  stored11.map((e) => e.payload.ev).join(",") === "fresh,brand_new",
  "only non-expired remain",
  JSON.stringify(stored11.map((e) => e.payload.ev)),
)

console.log("\n=== 12. setupOutboxDrainTriggers: 'online' fires drain ===")
reset()
saveToOutbox(makePayload("online_test") as never)
let drainCalls = 0
setupOutboxDrainTriggers(async () => {
  drainCalls++
  return "ok"
})
win.dispatch("online")
await new Promise((r) => setTimeout(r, 30))
expect(drainCalls === 1, "online event fires send once", `drainCalls=${drainCalls}`)
expect(getOutboxSize() === 0, "outbox emptied via online drain", String(getOutboxSize()))

console.log("\n=== 13. setupOutboxDrainTriggers: visibilitychange to visible fires drain ===")
reset()
saveToOutbox(makePayload("vis_test") as never)
let visDrains = 0
setupOutboxDrainTriggers(async () => {
  visDrains++
  return "ok"
})
doc.visibilityState = "hidden"
doc.dispatch("visibilitychange")
await new Promise((r) => setTimeout(r, 30))
expect(visDrains === 0, "no drain when becoming hidden", `drains=${visDrains}`)
doc.visibilityState = "visible"
doc.dispatch("visibilitychange")
await new Promise((r) => setTimeout(r, 30))
expect(visDrains === 1, "drain when becoming visible", `drains=${visDrains}`)

console.log("\n=== 14. corrupt localStorage value is treated as empty ===")
reset()
storage.setItem(__retryInternals.OUTBOX_KEY, "{not valid json")
expect(getOutboxSize() === 0, "corrupt JSON returns 0 size", String(getOutboxSize()))
saveToOutbox(makePayload("recovered") as never)
const stored14 = JSON.parse(storage.getItem(__retryInternals.OUTBOX_KEY)!) as Array<unknown>
expect(stored14.length === 1, "fresh save overwrites corrupt entry", String(stored14.length))

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed)
console.log(`\n=== SUMMARY: ${passed}/${results.length} passed ===`)
if (failed.length > 0) {
  console.log("\nFailures:")
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}
