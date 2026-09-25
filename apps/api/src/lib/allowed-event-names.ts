export const ALLOWED_INGEST_EVENT_NAMES = [
  'sdk_connected',
  'page_view',
  'page_leave',
  'scroll_25',
  'scroll_50',
  'scroll_75',
  'scroll_100',
  'scroll_depth',
  'heatmap_click',
  'heatmap_move',
  'heatmap_section',
  'heatmap_field_focus',
  'call_click',
  'link_click',
  'button_click',
  'form_start',
  'form_submit',
  'form_success',
  'form_field_focus',
  'form_field_abandon',
  'form_step_view',
  'form_step_complete',
  'zip_start',
  'zip_submit',
  'service_click',
  'heartbeat',
  'web_vitals',
  '_fi',
] as const

export type AllowedIngestEventName = (typeof ALLOWED_INGEST_EVENT_NAMES)[number]

const ALLOWED_SET = new Set<string>(ALLOWED_INGEST_EVENT_NAMES)

export function isAllowedIngestEventName(event: string): boolean {
  return ALLOWED_SET.has(event)
}
