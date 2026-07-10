'use client';

import {
  DEFAULT_UTM_DENIED_PATH,
  emptyBlockedUtmSets,
  isAccessDeniedPath,
  isUtmBlocked,
  normalizeDeniedPath,
  toBlockedUtmSets,
  type BlockedUtmLists,
  type BlockedUtmSets,
} from '../model/utm-block';
import {
  UTM_COOKIE_NAMES,
  UTM_URL_PARAM_KEYS,
} from '../model/utm-params';
import { getCookie } from './cookie-utils';

const RULES_CACHE_MS = 60_000;
const RULES_CACHE_PREFIX = 'aro_utm_blk_';

export type UseUtmBlockGuardOptions = {
  deniedPath?: string;
  pathname?: string;
};

function getScriptEl(): HTMLScriptElement | null {
  if (typeof document === 'undefined') return null;
  return (
    document.getElementById('arohaa-sdk') ??
    document.querySelector('script[data-wid][data-api]')
  ) as HTMLScriptElement | null;
}

function readAttribution(): { utm_source: string; utm_s1: string } {
  if (typeof window === 'undefined') {
    return { utm_source: '', utm_s1: '' };
  }

  const urlParams = new URLSearchParams(window.location.search);
  let utmSource = urlParams.get(UTM_URL_PARAM_KEYS.subid1) ?? '';
  let utmS1 = urlParams.get(UTM_URL_PARAM_KEYS.subid3) ?? '';

  if (!utmSource) utmSource = getCookie(UTM_COOKIE_NAMES.subid1) ?? '';
  if (!utmS1) utmS1 = getCookie(UTM_COOKIE_NAMES.subid3) ?? '';

  return { utm_source: utmSource, utm_s1: utmS1 };
}

function rulesCacheKey(wid: string): string {
  return `${RULES_CACHE_PREFIX}${wid}`;
}

function readCachedRules(wid: string): BlockedUtmLists | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(rulesCacheKey(wid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      exp: number;
      data: BlockedUtmLists;
    };
    if (!parsed?.data || parsed.exp <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedRules(wid: string, data: BlockedUtmLists): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      rulesCacheKey(wid),
      JSON.stringify({ exp: Date.now() + RULES_CACHE_MS, data }),
    );
  } catch {
    // Ignore quota errors.
  }
}

async function fetchBlockedRules(
  apiBase: string,
  wid: string,
): Promise<BlockedUtmSets> {
  const cached = readCachedRules(wid);
  if (cached) return toBlockedUtmSets(cached);

  const base = apiBase.replace(/\/$/, '');
  const url = `${base}/v1/utm-blocked?wid=${encodeURIComponent(wid)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) return emptyBlockedUtmSets();
    const data = (await response.json()) as BlockedUtmLists;
    const lists: BlockedUtmLists = {
      utm_source: Array.isArray(data.utm_source) ? data.utm_source : [],
      utm_s1: Array.isArray(data.utm_s1) ? data.utm_s1 : [],
    };
    writeCachedRules(wid, lists);
    return toBlockedUtmSets(lists);
  } catch {
    return emptyBlockedUtmSets();
  }
}

function redirectToDeniedPath(deniedPath: string): void {
  if (typeof window === 'undefined') return;
  const target = normalizeDeniedPath(deniedPath);
  if (window.location.pathname === target) return;
  window.location.replace(target);
}

export async function enforceUtmBlock(
  options?: UseUtmBlockGuardOptions,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const script = getScriptEl();
  const wid = script?.getAttribute('data-wid')?.trim() ?? '';
  const apiBase = script?.getAttribute('data-api')?.trim() ?? '';
  if (!wid || !apiBase) return false;

  const deniedPath = normalizeDeniedPath(
    options?.deniedPath ??
      script?.getAttribute('data-utm-denied-path') ??
      DEFAULT_UTM_DENIED_PATH,
  );

  const pathname = options?.pathname ?? window.location.pathname;
  const blockedSets = await fetchBlockedRules(apiBase, wid);
  const attribution = readAttribution();
  const blocked = isUtmBlocked(
    blockedSets,
    attribution.utm_source,
    attribution.utm_s1,
  );

  if (!blocked) return false;
  if (isAccessDeniedPath(pathname, deniedPath)) return true;

  redirectToDeniedPath(deniedPath);
  return true;
}
