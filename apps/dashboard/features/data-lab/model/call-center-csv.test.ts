import { describe, expect, it } from "vitest"
import {
  computeCallCenterSourceRollups,
  parseCallCenterCsv,
  parseCallCenterTimestampEst,
  parseYesNo,
} from "./call-center-csv"

describe("call-center-csv", () => {
  it("parses yes/no flags", () => {
    expect(parseYesNo("Yes")).toBe(true)
    expect(parseYesNo("No")).toBe(false)
    expect(parseYesNo("Y")).toBe(true)
  })

  it("parses EST timestamps", () => {
    const d = parseCallCenterTimestampEst("26/10/2026 00:57")
    expect(d).toBeInstanceOf(Date)
    expect(d?.getTime()).toBeGreaterThan(0)
  })

  it("parses sample header and aggregates by SID", () => {
    const csv = [
      "Lead ID,Lead Type,Affiliate (AID),Company Name,CID,SID,TID,KS,UID,Click ID,Sub1,Homeowner,Insured?,Vehicles,State,Status,Timestamp (EST),Duplicate,CC Contacted,CC Disposition,CC Transferred,15m+ Duration,20m+ Duration",
      "1,Auto,A,C,1,339,tid1,,uid1,,s1,TRUE,TRUE,1,CA,,26/10/2026 00:57,N,Yes,,Yes,Yes,No",
      "2,Auto,A,C,1,339,tid2,,uid2,,s1,FALSE,TRUE,1,TX,,26/10/2026 01:00,N,No,,No,No,No",
      "3,Auto,A,C,1,,tid3,,uid3,,s1,TRUE,FALSE,2,NY,,26/10/2026 02:00,Y,Yes,,No,No,No",
    ].join("\n")

    const parsed = parseCallCenterCsv(csv)
    expect(parsed.errors).toEqual([])
    expect(parsed.rows).toHaveLength(3)
    const rollups = computeCallCenterSourceRollups(parsed.rows)
    expect(rollups[0]?.sid).toBe("339")
    expect(rollups[0]?.leads).toBe(2)
    expect(rollups[0]?.contacted).toBe(1)
    expect(rollups[0]?.transferred).toBe(1)
    expect(rollups.find((row) => row.sid === "—")?.leads).toBe(1)
  })
})
