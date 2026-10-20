import {
  contactRiskFromMatches,
  loadRelatedContactMatches,
  type ContactMatchStatus,
} from './contact-match.js'

export type ContactRiskSignals = {
  contactMatchStatus: ContactMatchStatus
  contactMatchTruncated: boolean
  contactRepeatedAcrossPages: boolean
  contactRepeatedAcrossPartners: boolean
  samePhoneDifferentNames: boolean
  samePhoneDifferentEmails: boolean
  contactLocationChanged: boolean
  relatedMarkedInvalidCount: number
  evidenceToken: string
}

const EMPTY_UNAVAILABLE: ContactRiskSignals = {
  contactMatchStatus: 'unavailable',
  contactMatchTruncated: false,
  contactRepeatedAcrossPages: false,
  contactRepeatedAcrossPartners: false,
  samePhoneDifferentNames: false,
  samePhoneDifferentEmails: false,
  contactLocationChanged: false,
  relatedMarkedInvalidCount: 0,
  evidenceToken: 'unavailable',
}

export async function loadContactRiskSignals(input: {
  tenantWorkspaceId?: string
  landingPageId: string
  sessionId: string
  lookbackDays?: number
}): Promise<ContactRiskSignals> {
  const tenant = (input.tenantWorkspaceId || '').trim()
  if (!tenant) {
    return {
      ...EMPTY_UNAVAILABLE,
      contactMatchStatus: 'no_tenant',
      evidenceToken: 'no_tenant',
    }
  }
  try {
    const match = await loadRelatedContactMatches({
      tenantWorkspaceId: tenant,
      landingPageId: input.landingPageId,
      sessionId: input.sessionId,
      lookbackDays: input.lookbackDays,
      limit: 500,
      offset: 0,
    })
    const risk = await contactRiskFromMatches(match)
    return {
      contactMatchStatus: risk.status,
      contactMatchTruncated: risk.contactMatchTruncated,
      contactRepeatedAcrossPages: risk.contactRepeatedAcrossPages,
      contactRepeatedAcrossPartners: risk.contactRepeatedAcrossPartners,
      samePhoneDifferentNames: risk.samePhoneDifferentNames,
      samePhoneDifferentEmails: risk.samePhoneDifferentEmails,
      contactLocationChanged: risk.contactLocationChanged,
      relatedMarkedInvalidCount: risk.relatedMarkedInvalidCount,
      evidenceToken: risk.evidenceToken,
    }
  } catch {
    return { ...EMPTY_UNAVAILABLE }
  }
}
