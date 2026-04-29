interface SourceRule {
  source: string
  matches: string[]
}

const RULES: SourceRule[] = [
  {
    source: 'Google',
    matches: [
      'google.com',
      'google.co.in',
      'google.co.uk',
      'google.ca',
      'google.de',
      'google.fr',
      'google.es',
      'google.com.au',
      'google.com.br',
      'google.co.jp',
      'googleadservices.com',
      'googlesyndication.com',
    ],
  },
  {
    source: 'Facebook',
    matches: ['facebook.com', 'fb.com', 'fb.me', 'l.facebook.com', 'm.facebook.com'],
  },
  { source: 'Instagram', matches: ['instagram.com', 'l.instagram.com'] },
  { source: 'X/Twitter', matches: ['twitter.com', 'x.com', 't.co'] },
  { source: 'LinkedIn', matches: ['linkedin.com', 'lnkd.in'] },
  { source: 'YouTube', matches: ['youtube.com', 'youtu.be', 'm.youtube.com'] },
  { source: 'TikTok', matches: ['tiktok.com'] },
  { source: 'Reddit', matches: ['reddit.com', 'old.reddit.com'] },
  { source: 'Bing', matches: ['bing.com'] },
  { source: 'DuckDuckGo', matches: ['duckduckgo.com'] },
  { source: 'Yahoo', matches: ['yahoo.com', 'search.yahoo.com'] },
  { source: 'Pinterest', matches: ['pinterest.com'] },
  { source: 'WhatsApp', matches: ['whatsapp.com', 'wa.me'] },
  { source: 'Telegram', matches: ['t.me', 'telegram.me'] },
  { source: 'GitHub', matches: ['github.com'] },
]

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain)
}

function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host
}

export function normalizeReferrer(rawReferrer: string | undefined | null): string {
  if (!rawReferrer || rawReferrer === 'direct') return 'direct'

  let host: string
  try {
    host = new URL(rawReferrer).hostname.toLowerCase()
  } catch {
    return 'unknown'
  }

  if (host.length === 0) return 'unknown'

  for (const rule of RULES) {
    for (const domain of rule.matches) {
      if (hostMatches(host, domain)) return rule.source
    }
  }

  return stripWww(host)
}
