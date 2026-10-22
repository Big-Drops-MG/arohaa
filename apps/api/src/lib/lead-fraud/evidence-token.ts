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
  shadowToken = '',
  networkDatasetToken = '',
  utmReputationToken = '',
): string {
  return [
    contactToken || 'contact:none',
    behaviorToken || 'fi:unknown',
    shadowToken || 'shadow:none',
    networkDatasetToken || 'net:none',
    utmReputationToken || 'utmrep:none',
  ].join('||')
}

export function networkEvidenceToken(fingerprint: string): string {
  const value = fingerprint.trim()
  return value ? `net:${value}` : 'net:none'
}


export function shadowEvidenceToken(
  findings:
    | Array<{
        code?: string
        detail?: string
        evidenceRefs?: string[]
        availability?: string
        proposedScoreDelta?: number
        featureVersion?: string
      }>
    | undefined,
  stableEvidenceKey = '',
): string {
  if ((!findings || findings.length === 0) && !stableEvidenceKey) {
    return 'shadow:none'
  }
  const findingPart = (findings ?? [])
    .map((f) =>
      [
        f.code || '',
        f.detail || '',
        (f.evidenceRefs ?? []).slice().sort().join(','),
        f.availability || '',
        String(f.proposedScoreDelta ?? ''),
        f.featureVersion || '',
      ].join(':'),
    )
    .sort()
    .join('|')
  return `shadow:${stableEvidenceKey || 'k'}::${findingPart || 'none'}`
}
