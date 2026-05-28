export interface ThankYouAd {
  image: string
  /** URL; use {{utm_source}}, {{utm_id}}, {{utm_s1}} for UTM substitution */
  link: string
}

export interface ThankYouUtmCookieNames {
  source: string
  id: string
  s1: string
}

export type ThankYouContentVariant = "1" | "2"

export interface ThankYouContentProps {
  variant?: ThankYouContentVariant
  title?: string
  subtitle?: string
  showBuyerLogo?: boolean
  buyerLogoPath?: (buyer: string) => string
  confirmationTitle?: string
  confirmationDescription?: string
  contactTitle?: string
  contactPhoneLabel?: string
  contactPhoneHref?: string
  redirectPath?: string
  sendWelcomeEmail?: boolean
  sendEmailApiPath?: string
  validateAccessApiPath?: string | null
  useLocalStorageToken?: boolean
  ads?: ThankYouAd[]
  adSectionTitle?: string
  utmCookieNames?: ThankYouUtmCookieNames
  formDataStorageKey?: string
  loadingFallback?: React.ReactNode
}
