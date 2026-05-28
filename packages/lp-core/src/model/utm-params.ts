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
