import type { ArohaaQueueStub } from "./types/global"

;(function (
  w: Window,
  d: Document,
  tagName: "script",
  sdkUrl: string,
  workspaceId: string,
  apiBase: string,
) {
  if (w.arohaa) return

  const stub = function (this: unknown) {
    ;(stub.q = stub.q || []).push(arguments)
  } as ArohaaQueueStub
  stub.q = []
  stub.l = Date.now()
  w.arohaa = stub

  const script = d.createElement(tagName)
  script.async = true
  script.id = "arohaa-sdk"
  script.src = sdkUrl
  script.setAttribute("data-wid", workspaceId)
  if (apiBase) script.setAttribute("data-api", apiBase)

  const firstScript = d.getElementsByTagName(tagName)[0]
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript)
  } else {
    d.head.appendChild(script)
  }
})(
  window,
  document,
  "script",
  "__AROHAA_SDK_URL__",
  "__AROHAA_WID__",
  "__AROHAA_API_BASE__",
)
