import { describe, expect, it } from "vitest"
import {
  heatmapModeToAclSection,
  insightSectionToAclSection,
  resolveRouteSectionId,
} from "./route-section.js"

describe("route section ACL helpers", () => {
  it("maps insight sections onto data-lab ACL ids", () => {
    expect(insightSectionToAclSection("volume")).toBe("level-1")
    expect(insightSectionToAclSection("source")).toBe("level-1")
    expect(insightSectionToAclSection(null)).toBe("level-1")
  })

  it("maps heatmap mode query values onto heatmap ACL ids", () => {
    expect(heatmapModeToAclSection("scroll")).toBe("scroll")
    expect(heatmapModeToAclSection(null)).toBe("click")
  })

  it("resolves fixed and query-backed section config", () => {
    const request = new Request("https://app.test/api?section=leads")
    expect(resolveRouteSectionId("leads", request)).toBe("leads")
    expect(
      resolveRouteSectionId(
        { queryParam: "section", resolve: (raw) => raw ?? "" },
        request
      )
    ).toBe("leads")
  })
})
