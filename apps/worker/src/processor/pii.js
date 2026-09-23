import crypto from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_KEY_HINT = /email/i;

const LEAD_FIELDS_KEY = 'fields';
const OPAQUE_PROP_KEY = '_k';

function hashOpaqueValue(value) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function hashEmail(email) {
  return hashOpaqueValue(email);
}

function resolveFieldBlobKey() {
  const fromEnv = process.env.AROHAA_FIELD_BLOB_KEY?.trim();
  if (fromEnv) {
    try {
      const buf = Buffer.from(fromEnv, 'base64');
      if (buf.length === 32) return buf;
    } catch {
      // fall through
    }
    return crypto.createHash('sha256').update(fromEnv).digest();
  }
  const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim();
  if (!secret) return null;
  return crypto
    .createHash('sha256')
    .update(`arohaa-field-blob:${secret}`)
    .digest();
}

function encryptFieldBlob(fields) {
  const key = resolveFieldBlobKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(fields), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

function coerceFieldMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === LEAD_FIELDS_KEY || k === OPAQUE_PROP_KEY) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function maskEmailValue(value) {
  if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) return value;
  return hashEmail(value);
}

function maskPlaintextLeadFields(fields) {
  const next = { ...fields };
  let modified = false;
  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    next[key] = hashOpaqueValue(trimmed);
    modified = true;
  }
  return modified ? next : fields;
}

function sealOrMaskLeadFields(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return props;
  const fields = coerceFieldMap(props[LEAD_FIELDS_KEY]);
  if (!fields) return props;

  const next = { ...props };
  delete next[LEAD_FIELDS_KEY];

  const sealed = encryptFieldBlob(fields);
  if (sealed) {
    next[OPAQUE_PROP_KEY] = sealed;
    return next;
  }

  next[LEAD_FIELDS_KEY] = maskPlaintextLeadFields(fields);
  return next;
}

function maskPropertiesObject(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return props;

  const sealed = sealOrMaskLeadFields(props);
  let modified = sealed !== props;
  const next = { ...sealed };

  for (const [key, value] of Object.entries(next)) {
    if (key === LEAD_FIELDS_KEY || key === OPAQUE_PROP_KEY) continue;

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

function stripUrlQueryAndHash(url) {
  if (typeof url !== 'string' || !url) return url;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    const q = url.indexOf('?');
    const h = url.indexOf('#');
    let end = url.length;
    if (q >= 0) end = Math.min(end, q);
    if (h >= 0) end = Math.min(end, h);
    return url.slice(0, end);
  }
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

export function anonymizeHeatmapEvent(event) {
  const base = anonymizeEvent(event);
  if (!base || typeof base !== 'object') return base;
  const next = { ...base };
  if (typeof next.url === 'string') {
    next.url = stripUrlQueryAndHash(next.url);
  }
  return next;
}
