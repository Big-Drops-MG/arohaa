'use client';

import { useEffect, useRef, useState } from 'react';
import type { UtmParamsResult, UseUtmParamsOptions } from '../model/utm-params';
import {
  UTM_COOKIE_NAMES,
  UTM_URL_PARAM_KEYS,
  DEFAULT_UTM_COOKIE_DAYS,
} from '../model/utm-params';
import { getCookie, setCookie } from './cookie-utils';

function resolveOptions(
  options?: number | UseUtmParamsOptions
): { cookieDays: number; extra: UseUtmParamsOptions['extra'] } {
  if (options == null) {
    return { cookieDays: DEFAULT_UTM_COOKIE_DAYS, extra: undefined };
  }
  if (typeof options === 'number') {
    return { cookieDays: options, extra: undefined };
  }
  return {
    cookieDays: options.cookieDays ?? DEFAULT_UTM_COOKIE_DAYS,
    extra: options.extra,
  };
}

export function useUtmParams(
  options?: number | UseUtmParamsOptions
): UtmParamsResult {
  const { cookieDays, extra: extraMappings } = resolveOptions(options);
  const extraMappingsRef = useRef(extraMappings);

  const [subid1, setSubid1] = useState('');
  const [subid2, setSubid2] = useState('');
  const [subid3, setSubid3] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});

  useEffect(() => {
    extraMappingsRef.current = extraMappings;
  }, [extraMappings]);

  /* eslint-disable react-hooks/set-state-in-effect --
   * Reads URL + cookies (external) and mirrors into display state.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mappings = extraMappingsRef.current;
    const urlParams = new URLSearchParams(window.location.search);
    let utmSource = urlParams.get(UTM_URL_PARAM_KEYS.subid1) ?? '';
    let utmId = urlParams.get(UTM_URL_PARAM_KEYS.subid2) ?? '';
    let utmS1 = urlParams.get(UTM_URL_PARAM_KEYS.subid3) ?? '';

    const extraValues: Record<string, string> = {};
    if (mappings?.length) {
      for (const { urlParam, cookieName } of mappings) {
        const fromUrl = urlParams.get(urlParam) ?? '';
        const fromCookie = getCookie(cookieName) ?? '';
        const value = fromUrl || fromCookie;
        if (value) {
          extraValues[cookieName] = value;
          if (fromUrl) setCookie(cookieName, fromUrl, cookieDays);
        }
      }
    }

    const hasCoreInUrl = !!(utmSource || utmId || utmS1);
    const hasExtraInUrl = mappings?.some(
      (m) => urlParams.get(m.urlParam)
    );
    const shouldPersistAndClean = hasCoreInUrl || hasExtraInUrl;

    if (shouldPersistAndClean) {
      if (utmSource) setCookie(UTM_COOKIE_NAMES.subid1, utmSource, cookieDays);
      if (utmId) setCookie(UTM_COOKIE_NAMES.subid2, utmId, cookieDays);
      if (utmS1) setCookie(UTM_COOKIE_NAMES.subid3, utmS1, cookieDays);

      const cleanUrl =
        window.location.protocol +
        '//' +
        window.location.host +
        window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else {
      utmSource = getCookie(UTM_COOKIE_NAMES.subid1) ?? '';
      utmId = getCookie(UTM_COOKIE_NAMES.subid2) ?? '';
      utmS1 = getCookie(UTM_COOKIE_NAMES.subid3) ?? '';

      if (mappings?.length) {
        for (const { cookieName } of mappings) {
          const value = getCookie(cookieName) ?? '';
          if (value) extraValues[cookieName] = value;
        }
      }
    }

    setSubid1(utmSource);
    setSubid2(utmId);
    setSubid3(utmS1);
    if (mappings?.length) setExtra(extraValues);
  }, [cookieDays, extraMappings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const result: UtmParamsResult = { subid1, subid2, subid3 };
  if (extraMappings?.length) result.extra = extra;

  return result;
}
