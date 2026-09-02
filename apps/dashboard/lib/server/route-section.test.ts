import { describe, expect, it } from "vitest"
import {
  heatmapModeToAclSection,
  insightSectionToAclSection,
  resolveRouteSectionId,
} from "./route-section.js"

describe("route section ACL helpers", () => {
  it("maps insight sections onto data-lab ACL ids", () => {
    expect(insightSectionToAclSection("volume")).toBe("glance")
    expect(insightSectionToAclSection("source")).toBe("sources")
    expect(insightSectionToAclSection(null)).toBe("glance")
  })

  it("maps heatmap mode query values onto heatmap ACL ids", () => {
    expect(heatmapModeToAclSection("scroll")).toBe("scroll")
    expect(heatmapModeToAclSection(null)).toBe("click")
  })

  it("resolves fixed and query-backed section config", () => {
    const request = new Request("https://app.test/api?section=quality")
    expect(resolveRouteSectionId("leads", request)).toBe("leads")
    expect(
      resolveRouteSectionId(
        { queryParam: "section", resolve: insightSectionToAclSection },
        request
      )
    ).toBe("quality")
  })
})
