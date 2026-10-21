import {
  createFinding,
  type AssessmentFinding,
} from './findings.js'

export type PageIntegrityBaseline = {
  scriptOrigins?: string[]
  formActions?: string[]
  iframeOrigins?: string[]
}

export function findingsFromPageIntegrity(input: {
  props: Record<string, unknown> | null | undefined
  baseline?: PageIntegrityBaseline | null
}): AssessmentFinding[] {
  const findings: AssessmentFinding[] = []
  const props = input.props
  if (!props) return findings

  if (props.context_accessible === false) {
    findings.push(
      createFinding({
        code: 'page_integrity_context_inaccessible',
        detail: 'Page integrity observer could not access the document context',
        subject: 'visit',
        severity: 'info',
        source: 'page_integrity',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
      }),
    )
    return findings
  }

  const baseline = input.baseline
  if (!baseline) return findings

  const scriptOrigins = Array.isArray(props.script_origins)
    ? props.script_origins.map(String)
    : []
  const formActions = Array.isArray(props.form_actions)
    ? props.form_actions.map(String)
    : []
  const iframeOrigins = Array.isArray(props.iframe_origins)
    ? props.iframe_origins.map(String)
    : []

  const allowedScripts = new Set(baseline.scriptOrigins ?? [])
  for (const origin of scriptOrigins) {
    if (allowedScripts.size > 0 && !allowedScripts.has(origin)) {
      findings.push(
        createFinding({
          code: 'unexpected_script_origin',
          detail: `Script origin not in reviewed baseline: ${origin}`,
          subject: 'visit',
          severity: 'medium',
          source: 'page_integrity',
          availability: 'available',
          contributesToScore: false,
          shadow: true,
          proposedScoreDelta: 4,
        }),
      )
      break
    }
  }

  const allowedForms = new Set(baseline.formActions ?? [])
  const baselineForms = Array.isArray(props.baseline_form_actions)
    ? props.baseline_form_actions.map(String)
    : []
  const compareForms = allowedForms.size > 0 ? [...allowedForms] : baselineForms
  if (compareForms.length > 0) {
    for (const action of formActions) {
      if (!compareForms.includes(action)) {
        findings.push(
          createFinding({
            code: 'form_destination_changed',
            detail: `Form action changed from reviewed baseline: ${action}`,
            subject: 'visit',
            severity: 'high',
            source: 'page_integrity',
            availability: 'available',
            contributesToScore: false,
            shadow: true,
            proposedScoreDelta: 8,
          }),
        )
        break
      }
    }
  }

  const allowedFrames = new Set(baseline.iframeOrigins ?? [])
  for (const origin of iframeOrigins) {
    if (allowedFrames.size > 0 && !allowedFrames.has(origin)) {
      findings.push(
        createFinding({
          code: 'unexpected_frame_observed',
          detail: `Iframe origin not in reviewed baseline: ${origin}`,
          subject: 'visit',
          severity: 'medium',
          source: 'page_integrity',
          availability: 'available',
          contributesToScore: false,
          shadow: true,
          proposedScoreDelta: 4,
        }),
      )
      break
    }
  }

  return findings
}
