import type { FiBehaviorSummary } from './fi-batch.js'

export function behaviorEvidenceToken(
  fi: FiBehaviorSummary | null | undefined,
): string {
  if (!fi?.fiBehaviorKnown) return 'fi:unknown'
  return [
    'fi:known',
    fi.fillDurationMs == null ? 'null' : String(fi.fillDurationMs),
    String(fi.typedCount),
    String(fi.pasteCount),
    fi.pastedEmail ? '1' : '0',
    fi.pastedName ? '1' : '0',
    fi.pastedPhone ? '1' : '0',
    fi.hasFormStarted ? '1' : '0',
    fi.hasFieldInteraction ? '1' : '0',
  ].join(':')
}

export function composeEvidenceToken(
  contactToken: string,
  behaviorToken: string,
): string {
  return `${contactToken || 'contact:none'}||${behaviorToken || 'fi:unknown'}`
}
