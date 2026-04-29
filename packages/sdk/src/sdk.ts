import { initSDK, track } from "./index"
import type { ArohaaApi, ArohaaQueueStub } from "./types/global"

initSDK()

if (typeof window !== "undefined") {
  const existing = window.arohaa as ArohaaQueueStub | undefined
  const queued = existing?.q ?? []
  const startedAt = existing?.l

  const arohaa = function (
    this: unknown,
    event: string,
    props?: Record<string, unknown>,
  ) {
    track(event, props ?? {})
  } as ArohaaApi

  arohaa.track = (event, props) => track(event, props ?? {})
  arohaa.q = []
  if (typeof startedAt === "number") arohaa.l = startedAt

  window.arohaa = arohaa

  for (let i = 0; i < queued.length; i++) {
    const args = queued[i]
    if (!args || args.length === 0) continue
    try {
      const event = args[0]
      const props = args[1] as Record<string, unknown> | undefined
      if (typeof event === "string") {
        arohaa(event, props)
      }
    } catch (err) {
      console.error("[arohaa] failed to drain queued event", err)
    }
  }
}
