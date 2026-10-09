/** Clear labels for analytics event_name values shown in Warehouse and similar UIs. */
const EVENT_DISPLAY_NAMES: Record<string, string> = {
  sdk_connected: "SDK connected",
  page_view: "Page view",
  page_leave: "Page leave",
  scroll_25: "Scroll 25%",
  scroll_50: "Scroll 50%",
  scroll_75: "Scroll 75%",
  scroll_100: "Scroll 100%",
  scroll_depth: "Scroll depth",
  heatmap_click: "Heatmap click",
  heatmap_move: "Heatmap move",
  heatmap_section: "Heatmap section",
  heatmap_field_focus: "Heatmap field focus",
  call_click: "Call click",
  link_click: "Link click",
  button_click: "Button click",
  form_start: "Form started",
  form_submit: "Form submitted",
  form_success: "Form success",
  form_field_focus: "Form field focus",
  form_field_abandon: "Form field abandoned",
  form_step_view: "Form step viewed",
  form_step_complete: "Form step completed",
  zip_start: "ZIP started",
  zip_submit: "ZIP submitted",
  service_click: "Service click",
  heartbeat: "Heartbeat",
  web_vitals: "Web vitals",
  _fi: "Form interaction log",
}

function titleCaseToken(token: string): string {
  if (!token) return token
  if (token.toLowerCase() === "zip") return "ZIP"
  if (token.toLowerCase() === "sdk") return "SDK"
  if (token.toLowerCase() === "fi") return "FI"
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

/**
 * Returns a clear, human-readable label for an analytics event name.
 */
export function getEventDisplayName(eventName: string): string {
  const key = eventName.trim()
  if (!key) return "Unknown event"
  const mapped = EVENT_DISPLAY_NAMES[key]
  if (mapped) return mapped

  return key
    .replace(/^_/, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ")
}
