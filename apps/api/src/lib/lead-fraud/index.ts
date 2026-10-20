export {
  LEAD_FRAUD_MODEL_VERSION,
  LEAD_FRAUD_THRESHOLDS,
  isLeadFraudLabel,
  labelFromTrustScore,
} from './constants.js'
export { scoreLeadFraud } from './score.js'
export { parseFiBehavior, looksLikeNonsenseName, emptyFeatures } from './features.js'
export {
  buildFeaturesFromLeadSessionSignal,
  computeLeadVelocityMaps,
} from './field-signals.js'
export {
  ensureSessionFraudAssessment,
  ensureSessionsFraudAssessments,
  classifyLeadSessionRows,
} from './service.js'
export { getRelatedSubmissions } from './related-submissions.js'
export {
  fetchLeadReview,
  fetchLeadReviewHistory,
  upsertLeadReview,
  countPendingReviews,
} from './lead-review.js'
export {
  withLeadReviewLock,
  claimLeadReviewRevision,
} from './review-lock.js'
export { loadContactRiskSignals } from './contact-risk.js'
export {
  loadRelatedContactMatches,
  RELATED_MATCH_FETCH_LIMIT,
} from './contact-match.js'
export {
  isCommonConsumerEmailDomain,
} from './disposable-domains.js'
export { hashContactValueAll } from './contact-hash.js'
export { compareEnteredZipToIpGeo } from './location-compare.js'
export {
  behaviorEvidenceToken,
  composeEvidenceToken,
} from './evidence-token.js'
export type {
  LeadFraudAssessment,
  LeadFraudFeatures,
  LeadFraudLabel,
  LeadFraudFinding,
  LeadSignalCoverage,
} from './types.js'
