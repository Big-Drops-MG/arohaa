import crypto from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_KEY_HINT = /email/i;

export function hashEmail(email) {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function maskEmailValue(value) {
  if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) return value;
  return hashEmail(value);
}

function maskPropertiesObject(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return props;

  let modified = false;
  const next = { ...props };

  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'string') {
      if (EMAIL_KEY_HINT.test(key) || EMAIL_REGEX.test(value)) {
        next[key] = maskEmailValue(value);
        modified = true;
      }
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = maskPropertiesObject(value);
      if (nested !== value) {
        next[key] = nested;
        modified = true;
      }
    }
  }

  return modified ? next : props;
}

export function anonymizeEvent(event) {
  if (!event) return event;
  const cloned = { ...event };

  if (typeof cloned.user_id === 'string') {
    cloned.user_id = maskEmailValue(cloned.user_id);
  }

  if (typeof cloned.properties === 'string') {
    try {
      const props = JSON.parse(cloned.properties);
      const masked = maskPropertiesObject(props);
      if (masked !== props) {
        cloned.properties = JSON.stringify(masked);
      }
    } catch {
      // ignore JSON parse errors for properties
    }
  } else if (cloned.properties && typeof cloned.properties === 'object') {
    const masked = maskPropertiesObject(cloned.properties);
    if (masked !== cloned.properties) {
      cloned.properties = JSON.stringify(masked);
    }
  }

  return cloned;
}
