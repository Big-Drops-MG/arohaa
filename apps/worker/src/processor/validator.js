/**
 * Validates incoming events to ensure data accuracy and enforce workspace data separation.
 *
 * @param {Object} event - The raw parsed JSON event.
 * @returns {boolean} True if valid, false if invalid and should be dropped.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_NAME_RE = /^[a-z0-9_]+$/;
const MIN_CREATED_AT = Date.parse('2020-01-01T00:00:00.000Z');
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const workspaceId =
    typeof event.workspace_id === 'string' ? event.workspace_id.trim() : '';
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    console.warn(
      `[Validator] Dropping event: Missing or invalid workspace_id. Event: ${event.event_name}`,
    );
    return false;
  }

  const eventName =
    typeof event.event_name === 'string' ? event.event_name.trim() : '';
  if (!eventName || !EVENT_NAME_RE.test(eventName) || eventName.length > 50) {
    console.warn(
      `[Validator] Dropping event: Missing or invalid event_name for workspace ${workspaceId}`,
    );
    return false;
  }

  const userId = typeof event.user_id === 'string' ? event.user_id.trim() : '';
  if (!userId || userId.length < 8 || userId.length > 128) {
    console.warn(
      `[Validator] Dropping event: Missing or invalid user_id for workspace ${workspaceId}`,
    );
    return false;
  }

  const sessionId =
    typeof event.session_id === 'string' ? event.session_id.trim() : '';
  if (!sessionId || sessionId.length < 8 || sessionId.length > 128) {
    console.warn(
      `[Validator] Dropping event: Missing or invalid session_id for workspace ${workspaceId}`,
    );
    return false;
  }

  if (!event.created_at || typeof event.created_at !== 'string') {
    console.warn(
      `[Validator] Dropping event: Missing created_at for workspace ${workspaceId}`,
    );
    return false;
  }

  const ts = Date.parse(event.created_at.replace(' ', 'T'));
  if (Number.isNaN(ts)) {
    console.warn(
      `[Validator] Dropping event: Corrupted timestamp created_at = ${event.created_at}`,
    );
    return false;
  }

  if (ts < MIN_CREATED_AT || ts > Date.now() + MAX_FUTURE_SKEW_MS) {
    console.warn(
      `[Validator] Dropping event: created_at out of range = ${event.created_at}`,
    );
    return false;
  }

  return true;
}

const HEATMAP_EVENT_TYPES = ['click', 'mousemove', 'scroll'];

export function validateHeatmapEvent(event) {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const workspaceId =
    typeof event.workspace_id === 'string' ? event.workspace_id.trim() : '';
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    console.warn(
      `[Validator] Dropping heatmap event: Missing or invalid workspace_id.`,
    );
    return false;
  }

  const pageUrl =
    typeof event.page_url === 'string' ? event.page_url.trim() : '';
  if (!pageUrl || pageUrl.length > 2000) {
    console.warn(
      `[Validator] Dropping heatmap event: Missing or invalid page_url for workspace ${workspaceId}`,
    );
    return false;
  }

  const eventType =
    typeof event.event_type === 'string' ? event.event_type.trim() : '';
  if (!HEATMAP_EVENT_TYPES.includes(eventType)) {
    console.warn(
      `[Validator] Dropping heatmap event: Invalid event_type '${eventType}' for workspace ${workspaceId}`,
    );
    return false;
  }

  if (!event.timestamp || typeof event.timestamp !== 'string') {
    console.warn(
      `[Validator] Dropping heatmap event: Missing timestamp for workspace ${workspaceId}`,
    );
    return false;
  }

  const ts = Date.parse(event.timestamp.replace(' ', 'T'));
  if (Number.isNaN(ts)) {
    console.warn(
      `[Validator] Dropping heatmap event: Corrupted timestamp = ${event.timestamp}`,
    );
    return false;
  }

  if (ts < MIN_CREATED_AT || ts > Date.now() + MAX_FUTURE_SKEW_MS) {
    console.warn(
      `[Validator] Dropping heatmap event: timestamp out of range = ${event.timestamp}`,
    );
    return false;
  }

  if (typeof event.x !== 'number' || typeof event.y !== 'number') {
    console.warn(
      `[Validator] Dropping heatmap event: Missing or invalid x, y coordinates for workspace ${workspaceId}`,
    );
    return false;
  }

  if (typeof event.viewport_width !== 'number' || typeof event.viewport_height !== 'number') {
    console.warn(
      `[Validator] Dropping heatmap event: Missing or invalid viewport dimensions for workspace ${workspaceId}`,
    );
    return false;
  }

  return true;
}
