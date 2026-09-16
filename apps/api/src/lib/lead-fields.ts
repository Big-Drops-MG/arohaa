import { isPhoneFieldKey } from './field-blob.js'

const TRUTHY = new Set(['on', 'true', 'yes'])

const PEELABLE_BASE_RE =
  /^(?:car|driver|vehicle)_\d+_(?:year|make|model|gender|married|fault|dui|military|sr22|credit|homeowner|education|occupation|license|age)$/i

const EMAIL_KEY_RE = /^(email|e-mail|email_address|emailaddress)$/i
const ZIP_KEY_RE = /^(zip|zipcode|zip_code|postal)$/i


const FIRST_NAME_KEYS = new Set([
  // EN
  'first_name',
  'firstname',
  'fname',
  'given_name',
  'givenname',
  'forename',
  // ES
  'nombre_de_pila',
  'nombredepila',
  // PT
  'primeiro_nome',
  'primeironome',
  // FR
  'prenom',
  'prénom',
  // DE
  'vorname',
  // VI
  'tên',
  'ho_ten',
  // RU
  'имя',
  'imya',
  // AR
  'الاسم_الأول',
  'الاسم_الاول',
  'الاسم_الاوّل',
  'الاسمالأول',
  // KO
  '이름',
  // JA / ZH given name
  '名',
  'めい',
  '名字',
])

const LAST_NAME_KEYS = new Set([
  // EN
  'last_name',
  'lastname',
  'lname',
  'surname',
  'family_name',
  'familyname',
  // ES
  'apellido',
  'apellidos',
  // PT
  'sobrenome',
  'apelido',
  // FR
  'nom_de_famille',
  // DE
  'nachname',
  'familienname',
  // VI
  'họ',
  // RU
  'фамилия',
  'familiya',
  // AR
  'اسم_العائلة',
  'اسمالعائلة',
  'اللقب',
  // KO
  '성',
  '성씨',
  // JA / ZH family name
  '姓',
  'せい',
  '姓氏',
])

const NOISE_FIELD_RE =
  /^(input|select|textarea|search|receipt|xxtrustedform\w*|trustedform\w*|jornaya_lead_id|leadid_token|universal_leadid|consent-confirmation-certificate-id)$/i

const DOB_PART_RE = /^dob-0-(month|day|year)$/i

export function normalizeFieldKey(key: string): string {
  let out = key
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\-./]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  out = out.replace(/^(best|top|preferred)_/, '')
  return out
}

function isFirstNameKey(key: string): boolean {
  const n = normalizeFieldKey(key)
  if (FIRST_NAME_KEYS.has(n)) return true
  return /^(primeiro_?nome|nombre_?de_?pila|given_?name|first_?name|vorname|prenom|prénom)$/i.test(
    n,
  )
}

function isLastNameKey(key: string): boolean {
  const n = normalizeFieldKey(key)
  if (LAST_NAME_KEYS.has(n)) return true
  return /^(sobre_?nome|family_?name|last_?name|nachname|nom_?de_?famille|apellido[s]?)$/i.test(
    n,
  )
}

function isDigestValue(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value)
}

function isTruthyFlag(value: string): boolean {
  return TRUTHY.has(value.trim().toLowerCase())
}

function peelRadioKey(
  key: string,
  value: string,
): { base: string; option: string } | null {
  const idx = key.lastIndexOf('_')
  if (idx <= 0) return null
  const base = key.slice(0, idx)
  const option = key.slice(idx + 1)
  if (!option || !PEELABLE_BASE_RE.test(base)) return null

  const trimmed = value.trim()
  if (isTruthyFlag(trimmed)) return { base, option }
  if (trimmed.toLowerCase() === option.toLowerCase()) return { base, option }
  return null
}


function canonicalizeNameFields(fields: Record<string, string>): void {
  let firstName = fields.first_name?.trim() || ''
  let lastName = fields.last_name?.trim() || ''
  const aliasKeys: string[] = []

  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (/^first_name$/i.test(key) || /^last_name$/i.test(key)) continue

    if (isFirstNameKey(key)) {
      if (!firstName) firstName = trimmed
      aliasKeys.push(key)
      continue
    }

    if (isLastNameKey(key)) {
      if (!lastName) lastName = trimmed
      aliasKeys.push(key)
    }
  }

  for (const key of aliasKeys) {
    delete fields[key]
  }

  if (firstName) fields.first_name = firstName
  if (lastName) fields.last_name = lastName
}

export function normalizeLeadFields(
  raw: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (!key || isPhoneFieldKey(key) || NOISE_FIELD_RE.test(key)) continue
    const trimmed = String(value ?? '').trim()
    if (!trimmed) continue
    if (EMAIL_KEY_RE.test(key) && isDigestValue(trimmed)) continue

    const peeled = peelRadioKey(key, trimmed)
    if (peeled) {
      out[peeled.base] = peeled.option
      continue
    }

    if (isTruthyFlag(trimmed)) {
      out[key] = 'Yes'
      continue
    }

    out[key] = trimmed.slice(0, 500)
  }

  composeDob(out)
  dropDobParts(out)
  canonicalizeNameFields(out)
  return out
}

function dropDobParts(fields: Record<string, string>): void {
  const year = fields['dob-0-year'] ?? ''
  if (!fields.dob && year.replace(/\D/g, '').length === 4) return
  for (const key of Object.keys(fields)) {
    if (DOB_PART_RE.test(key)) delete fields[key]
  }
}

function pad2(value: string): string {
  return value.replace(/\D/g, '').padStart(2, '0').slice(-2)
}

function composeDob(fields: Record<string, string>): void {
  if (fields.dob) return
  const month = fields['dob-0-month'] || fields.dob_month
  const day = fields['dob-0-day'] || fields.dob_day
  const year = fields['dob-0-year'] || fields.dob_year || fields['birthday-year']
  if (!month || !day || !year) return
  const mm = pad2(month)
  const dd = pad2(day)
  const yyyy = year.replace(/\D/g, '').slice(0, 4)
  if (mm.length === 2 && dd.length === 2 && yyyy.length === 4) {
    fields.dob = `${mm}/${dd}/${yyyy}`
  }
}

export function pickLeadEmail(fields: Record<string, string>): string {
  for (const [key, value] of Object.entries(fields)) {
    if (!EMAIL_KEY_RE.test(key)) continue
    if (!value || isDigestValue(value)) continue
    return value
  }
  return ''
}

export function pickLeadZip(fields: Record<string, string>): string {
  for (const [key, value] of Object.entries(fields)) {
    if (!ZIP_KEY_RE.test(key)) continue
    const digits = value.replace(/\D/g, '').slice(0, 5)
    if (digits.length === 5) return digits
  }
  return ''
}

export function fieldsWithoutReserved(
  fields: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (EMAIL_KEY_RE.test(key) || ZIP_KEY_RE.test(key)) continue
    if (NOISE_FIELD_RE.test(key)) continue
    if (fields.dob && DOB_PART_RE.test(key)) continue
    out[key] = value
  }
  return out
}

export function isDisplayableLead(input: {
  zip?: string
  email?: string
  fields?: Record<string, string>
}): boolean {
  if (input.email?.trim()) return true
  if (input.zip?.trim()) return true
  const fields = input.fields ?? {}
  for (const [key, value] of Object.entries(fields)) {
    if (!value?.trim()) continue
    if (NOISE_FIELD_RE.test(key)) continue
    if (isDigestValue(value)) continue
    return true
  }
  return false
}

function asTrustedFormCertUrl(value: string): string {
  const trimmed = value.trim()
  if (/^https:\/\/cert\.trustedform\.com\//i.test(trimmed)) {
    return trimmed.slice(0, 500)
  }
  if (/^[a-f0-9]{40}$/i.test(trimmed)) {
    return `https://cert.trustedform.com/${trimmed.toLowerCase()}`
  }
  return ''
}

export function pickTrustedFormUrl(raw: Record<string, string>): string {
  const preferred = [
    raw.xxTrustedFormCertUrl,
    raw.TrustedFormCertUrl,
    raw.trustedFormCertUrl,
    raw.xxTrustedFormToken,
  ]
  for (const candidate of preferred) {
    const url = asTrustedFormCertUrl(String(candidate ?? ''))
    if (url) return url
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!/trustedformcerturl|xxtrustedformtoken/i.test(key)) continue
    if (/ping/i.test(key)) continue
    const url = asTrustedFormCertUrl(String(value ?? ''))
    if (url) return url
  }
  return ''
}
