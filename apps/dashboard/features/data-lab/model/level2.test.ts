import { describe, expect, it } from "vitest"
import {
  emptyLevel1Stats,
  filterLevel1StatsToVisibleLeadColumns,
} from "./level1"
import {
  filterLevel2StatsToVisibleLeadColumns,
  type Level2Stat,
} from "./level2"

const stats: Level2Stat[] = [
  {
    id: "best-car-0-make",
    label: "Best Car 0 Make",
    value: "Toyota",
    metricLabel: "Form submissions",
    metricValue: 2,
    enoughData: true,
  },
  {
    id: "best-driver-0-gender",
    label: "Driver 0 Gender Ratio (Male : Female)",
    value: "50% : 50%",
    breakdown: [
      { label: "Male", value: 1 },
      { label: "Female", value: 1 },
    ],
    enoughData: true,
  },
]

describe("filterLevel2StatsToVisibleLeadColumns", () => {
  it("keeps only stats whose columns are visible in the Leads table", () => {
    expect(
      filterLevel2StatsToVisibleLeadColumns(stats, ["car_0_make", "city"])
    ).toEqual([stats[0]])
  })
})

describe("filterLevel1StatsToVisibleLeadColumns", () => {
  it("hides Level 1 cards whose dependent Leads columns are not visible", () => {
    expect(
      filterLevel1StatsToVisibleLeadColumns(emptyLevel1Stats(), ["city"]).map(
        (stat) => stat.id
      )
    ).toEqual(["best-time", "best-zip", "form-submission-ratio", "best-city"])
  })
})
