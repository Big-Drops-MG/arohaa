export interface UtmParams {
  subid1: string;
  subid2: string;
  subid3: string;
}

export interface UtmParamMapping {
  urlParam: string;
  cookieName: string;
}

export interface UseUtmParamsOptions {
  cookieDays?: number;
  extra?: UtmParamMapping[];
}

export type UtmParamsResult = UtmParams & { extra?: Record<string, string> };

export const UTM_COOKIE_NAMES = {
  subid1: 'subid1',
  subid2: 'subid2',
  subid3: 'subid3',
} as const;

export const UTM_URL_PARAM_KEYS = {
  subid1: 'utm_source',
  subid2: 'utm_id',
  subid3: 'utm_s1',
} as const;

export const DEFAULT_UTM_COOKIE_DAYS = 30;

export const STORED_UTM_PARAM_KEYS = ['utm_source', 'utm_s1'] as const;

export type StoredUtmParamKey = (typeof STORED_UTM_PARAM_KEYS)[number];

export function isStoredUtmParamKey(key: string): key is StoredUtmParamKey {
  return (STORED_UTM_PARAM_KEYS as readonly string[]).includes(key);
}

export function getUtmParamLabel(key: string): string {
  if (key === 'utm_source') return 'Source';
  if (key === 'utm_s1') return 'S1';
  return key;
}

export function sanitizeUtmParamValue(key: StoredUtmParamKey, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const delimiterIndex = trimmed.search(/[&?#]/);
  const candidate = (
    delimiterIndex === -1 ? trimmed : trimmed.slice(0, delimiterIndex)
  ).trim();
  if (!candidate) return '';

  if (/\butm_[a-z0-9_]+=/i.test(candidate)) return '';

  if (key === 'utm_source' && candidate.includes('=')) return '';

  return candidate;
}

export function isMalformedStoredUtmValue(key: string, value: string): boolean {
  if (!isStoredUtmParamKey(key)) return true;
  const sanitized = sanitizeUtmParamValue(key, value);
  return !sanitized || sanitized !== value.trim();
}
