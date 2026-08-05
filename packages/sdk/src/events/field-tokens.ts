const XOR = 0x5a

function d(encoded: string): string {
  const bin = atob(encoded)
  let out = ""
  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ XOR)
  }
  return out
}

const T = {
  FIRST_NAME: d("PDMoKS4FNDs3Pw=="),
  LAST_NAME: d("NjspLgU0Ozc/"),
  DOB: d("PjU4"),
  MONTH: d("NzU0LjI="),
  DAY: d("Pjsj"),
  YEAR: d("Iz87KA=="),
  BIRTHDAY_YEAR: d("ODMoLjI+OyN3Iz87KA=="),
  MM: d("Nzc="),
  DD: d("Pj4="),
  YYYY: d("IyMjIw=="),
  FIRST: d("PDMoKS4="),
  LAST: d("NjspLg=="),
  NAME: d("NDs3Pw=="),
  EMAIL: d("Pzc7MzY="),
  EMAIL_ALT: d("Pzc7MzYmP3c3OzM2Jj83OzM2BTs+Pig/KSkmPzc7MzY7Pj4oPykp"),
}

export const KEYS = {
  firstName: T.FIRST_NAME,
  lastName: T.LAST_NAME,
  email: T.EMAIL,
  dob: T.DOB,
  dobMonth: `${T.DOB}-0-${T.MONTH}`,
  dobDay: `${T.DOB}-0-${T.DAY}`,
  dobYear: `${T.DOB}-0-${T.YEAR}`,
} as const

export const RE = {
  emailKey: new RegExp(`^(${T.EMAIL_ALT})$`, "i"),
  dobPartClass: new RegExp(`^${T.DOB}-\\d+-(${T.MONTH}|${T.DAY}|${T.YEAR})$`, "i"),
  dobControl: new RegExp(
    `${T.DOB}-\\d+-(${T.MONTH}|${T.DAY}|${T.YEAR})|${T.BIRTHDAY_YEAR}`,
    "i",
  ),
  birthdayYear: new RegExp(T.BIRTHDAY_YEAR, "i"),
  dobPlaceholder: new RegExp(`^(${T.MM}|${T.DD}|${T.YYYY})$`, "i"),
} as const

export const TOKENS = T
