export const LANDING_BRAND_MAX = 120;
export const LANDING_URL_MAX = 2048;

export type NormalizeLandingPageUrlOk = {
  ok: true;
  landingPageUrl: string;
  normalizedUrl: string;
  origin: string;
  hostname: string;
};

export type NormalizeLandingPageUrlErr = {
  ok: false;
  error: string;
};

export type NormalizeLandingPageUrlResult =
  | NormalizeLandingPageUrlOk
  | NormalizeLandingPageUrlErr;

function stripTrailingPathSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function normalizeLandingPageUrl(
  rawInput: string,
): NormalizeLandingPageUrlResult {
  const raw = rawInput.trim();
  if (!raw) {
    return { ok: false, error: 'Landing page URL is required' };
  }
  if (raw.length > LANDING_URL_MAX) {
    return { ok: false, error: 'Landing page URL is too long' };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid landing page URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'URL must start with http or https' };
  }

  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.toLowerCase();

  if (url.port === '80' && url.protocol === 'http:') {
    url.port = '';
  }
  if (url.port === '443' && url.protocol === 'https:') {
    url.port = '';
  }

  url.pathname = stripTrailingPathSlash(url.pathname);

  const landingPageUrl = url.toString();
  const normalizedUrl = landingPageUrl;
  const origin = url.origin;
  const hostname = url.hostname;

  return { ok: true, landingPageUrl, normalizedUrl, origin, hostname };
}

export function normalizedBrandName(
  raw: string,
):
  | { ok: true; brandName: string }
  | { ok: false; error: string } {
  const brandName = raw.trim();
  if (!brandName) {
    return { ok: false, error: 'Brand name is required' };
  }
  if (brandName.length > LANDING_BRAND_MAX) {
    return { ok: false, error: 'Brand name is too long' };
  }
  return { ok: true, brandName };
}

export function ingestHostnameMatchesLanding(
  eventUrlRaw: string | undefined,
  expectedHostnameLower: string,
  alternateHostnameLower?: string | null,
): boolean {
  if (!eventUrlRaw || !expectedHostnameLower) return false;
  try {
    const u = new URL(eventUrlRaw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === expectedHostnameLower.toLowerCase()) return true;
    if (
      alternateHostnameLower &&
      host === alternateHostnameLower.toLowerCase()
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function normalizeOptionalRedirectUrl(
  rawInput: string | null | undefined,
):
  | { ok: true; redirectPageUrl: string | null; redirectHostname: string | null; redirectOrigin: string | null }
  | { ok: false; error: string } {
  if (rawInput == null) {
    return {
      ok: true,
      redirectPageUrl: null,
      redirectHostname: null,
      redirectOrigin: null,
    };
  }
  const raw = String(rawInput).trim();
  if (!raw) {
    return {
      ok: true,
      redirectPageUrl: null,
      redirectHostname: null,
      redirectOrigin: null,
    };
  }
  const normalized = normalizeLandingPageUrl(raw);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error.replace(/^Landing page/, 'Redirect') };
  }
  return {
    ok: true,
    redirectPageUrl: normalized.landingPageUrl,
    redirectHostname: normalized.hostname,
    redirectOrigin: normalized.origin,
  };
}
