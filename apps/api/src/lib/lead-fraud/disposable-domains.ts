const DISPOSABLE_DOMAINS = new Set(
  [
    'mailinator.com',
    'guerrillamail.com',
    'guerrillamail.org',
    'sharklasers.com',
    'grr.la',
    'yopmail.com',
    'tempmail.com',
    'temp-mail.org',
    'throwawaymail.com',
    '10minutemail.com',
    'trashmail.com',
    'discard.email',
    'getnada.com',
    'maildrop.cc',
    'fakeinbox.com',
    'emailondeck.com',
    'mintemail.com',
    'moakt.com',
    'tempail.com',
    'dispostable.com',
    'mailnesia.com',
    'inboxkitten.com',
    'spamgourmet.com',
    'mailcatch.com',
    'mytemp.email',
    'tmpmail.net',
    'tmpmail.org',
    'tempinbox.com',
    'guerrillamailblock.com',
    'spam4.me',
    'trash-mail.com',
  ].map((d) => d.toLowerCase()),
)

const ROLE_LOCAL_PARTS = new Set([
  'admin',
  'administrator',
  'info',
  'contact',
  'support',
  'sales',
  'help',
  'office',
  'noreply',
  'no-reply',
  'donotreply',
  'marketing',
  'team',
  'hello',
  'test',
  'testing',
  'fake',
  'asdf',
])

const EMAIL_FORMAT_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 0) return ''
  return email.slice(at + 1).trim().toLowerCase()
}

export function emailLocalPart(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 0) return ''
  return email.slice(0, at).trim().toLowerCase()
}

export function isValidEmailFormat(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > 254) return false
  if (trimmed.includes('..')) return false
  if (!EMAIL_FORMAT_RE.test(trimmed)) return false
  const domain = emailDomain(trimmed)
  if (!domain.includes('.')) return false
  const tld = domain.split('.').pop() ?? ''
  if (tld.length < 2) return false
  return true
}

const COMMON_CONSUMER_DOMAINS = new Set(
  [
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.co.uk',
    'ymail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'mail.com',
    'gmx.com',
    'gmx.net',
    'comcast.net',
    'verizon.net',
    'att.net',
    'sbcglobal.net',
    'cox.net',
    'charter.net',
    'btinternet.com',
    'sky.com',
  ].map((d) => d.toLowerCase()),
)

export function isCommonConsumerEmailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase()
  return Boolean(d) && COMMON_CONSUMER_DOMAINS.has(d)
}

export function isDisposableEmailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase()
  if (!d) return false
  if (DISPOSABLE_DOMAINS.has(d)) return true
  return (
    d.startsWith('temp') ||
    d.includes('mailinator') ||
    d.includes('guerrillamail') ||
    d.includes('yopmail') ||
    d.includes('throwaway') ||
    d.includes('trashmail')
  )
}

export function isRoleEmailLocalPart(email: string): boolean {
  const local = emailLocalPart(email)
  if (!local) return false
  const base = local.split('+')[0] ?? local
  return ROLE_LOCAL_PARTS.has(base)
}


export function looksLikeRandomEmailLocal(email: string): boolean {
  const local = emailLocalPart(email).split('+')[0] ?? ''
  if (!local || local.length < 8) return false
  if (/^(test|user|asdf|qwer|zxcv)/i.test(local)) return true
  if (/^[0-9]+$/.test(local)) return true
  if (/^[a-f0-9]{16,}$/i.test(local)) return true

  const letters = local.replace(/[^a-z]/gi, '')
  const digits = local.replace(/\D/g, '')
  if (digits.length >= local.length * 0.5 && local.length >= 10) return true

  if (letters.length >= 8) {
    const vowels = (letters.match(/[aeiou]/gi) ?? []).length
    if (vowels / letters.length < 0.15) return true
  }

  if (
    !/[._-]/.test(local) &&
    /[a-z]/i.test(local) &&
    /\d/.test(local) &&
    local.length >= 12
  ) {
    return true
  }

  return false
}
