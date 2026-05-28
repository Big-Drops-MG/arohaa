const ICON_RELS = ['icon', 'shortcut icon', 'apple-touch-icon']

export function detectFaviconUrl(): string {
  if (typeof document === 'undefined') return ''

  const links = document.querySelectorAll<HTMLLinkElement>('link[rel]')
  for (const rel of ICON_RELS) {
    for (const link of links) {
      if (link.rel.toLowerCase() === rel && link.href) {
        return link.href
      }
    }
  }

  try {
    return new URL('/favicon.ico', window.location.origin).href
  } catch {
    return ''
  }
}
