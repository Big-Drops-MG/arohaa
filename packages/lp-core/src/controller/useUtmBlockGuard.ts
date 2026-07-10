'use client';

import { useEffect } from 'react';
import {
  enforceUtmBlock,
  type UseUtmBlockGuardOptions,
} from './utm-block-guard';

export function useUtmBlockGuard(options?: UseUtmBlockGuardOptions): void {
  const deniedPath = options?.deniedPath;
  const pathname = options?.pathname;

  useEffect(() => {
    void enforceUtmBlock({ deniedPath, pathname });
  }, [deniedPath, pathname]);
}
