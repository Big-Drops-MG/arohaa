/**
 * Validates incoming events to ensure data accuracy and enforce workspace data separation.
 *
 * @param {Object} event - The raw parsed JSON event.
 * @returns {boolean} True if valid, false if invalid and should be dropped.
 */
export function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    return false;
  }

  // 1. Enforce Workspace ID (Task 3: Workspace-based data separation)
  // Strict routing logic: every single event processed absolutely contains a valid workspace_id
  if (!event.workspace_id || typeof event.workspace_id !== 'string' || event.workspace_id.trim() === '') {
    console.warn(`[Validator] Dropping event: Missing or invalid workspace_id. Event: ${event.event_name}`);
    return false;
  }

  // 2. Ensure Data Accuracy and Consistency (Task 2: Validation step)
  // Required field: event_name
  if (!event.event_name || typeof event.event_name !== 'string' || event.event_name.trim() === '') {
    console.warn(`[Validator] Dropping event: Missing or invalid event_name for workspace ${event.workspace_id}`);
    return false;
  }

  // Validate corrupted timestamp if provided
  if (event.created_at) {
    const ts = new Date(event.created_at);
    if (isNaN(ts.getTime())) {
      console.warn(`[Validator] Dropping event: Corrupted timestamp created_at = ${event.created_at}`);
      return false;
    }
  }

  return true;
}
