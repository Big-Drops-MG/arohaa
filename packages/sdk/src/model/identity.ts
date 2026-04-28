import { getCookie, setCookie } from "../services/cookie.service"
import type { Identity } from "../types"
import { generateUUID } from "../utils/uuid"

export function initIdentity(): Identity {
  let uid = getCookie("aro_uid")
  let sid = getCookie("aro_sid")

  if (!uid) {
    uid = generateUUID()
    setCookie("aro_uid", uid)
  }

  if (!sid) {
    sid = generateUUID()
    setCookie("aro_sid", sid)
  }

  return { uid, sid }
}
