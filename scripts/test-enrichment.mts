import { parseUserAgent, extractClientIp } from "../apps/api/src/utils/enrichment.ts"
import { normalizeReferrer } from "../apps/api/src/utils/referrer.ts"

interface CaseResult {
  name: string
  passed: boolean
  detail: string
}
const results: CaseResult[] = []
function expect(cond: boolean, name: string, detail: string) {
  results.push({ name, passed: cond, detail })
  console.log(`  ${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`)
}

console.log("=== parseUserAgent ===")

const chromeWin = parseUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
)
expect(chromeWin.browser === "Chrome", "Chrome/Windows browser", JSON.stringify(chromeWin))
expect(chromeWin.os === "Windows", "Chrome/Windows os", JSON.stringify(chromeWin))
expect(chromeWin.device === "desktop", "Chrome/Windows device", JSON.stringify(chromeWin))

const safariMac = parseUserAgent(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
)
expect(safariMac.browser === "Safari", "Safari/macOS browser", JSON.stringify(safariMac))
expect(safariMac.os === "macOS", "Safari/macOS os", JSON.stringify(safariMac))
expect(safariMac.device === "desktop", "Safari/macOS device", JSON.stringify(safariMac))

const iphone = parseUserAgent(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
)
expect(iphone.device === "mobile", "iPhone -> mobile", JSON.stringify(iphone))
expect(iphone.os === "iOS", "iPhone os iOS", JSON.stringify(iphone))

const android = parseUserAgent(
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
)
expect(android.device === "mobile", "Android phone -> mobile", JSON.stringify(android))
expect(android.os === "Android", "Android os", JSON.stringify(android))

const ipad = parseUserAgent(
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
)
expect(ipad.device === "tablet", "iPad -> tablet", JSON.stringify(ipad))

const empty = parseUserAgent(undefined)
expect(empty.browser === "Unknown", "missing UA -> Unknown browser", JSON.stringify(empty))
expect(empty.device === "desktop", "missing UA -> default desktop device", JSON.stringify(empty))

const garbage = parseUserAgent("xxx-not-a-real-ua-string-xxx")
expect(garbage.browser === "Unknown", "garbage UA -> Unknown browser", JSON.stringify(garbage))

const huge = parseUserAgent("X".repeat(50_000))
expect(typeof huge.browser === "string", "20kb UA does not crash", JSON.stringify(huge).slice(0, 80))

console.log("\n=== normalizeReferrer ===")

expect(normalizeReferrer(undefined) === "direct", "undefined -> direct", "")
expect(normalizeReferrer("") === "direct", "empty -> direct", "")
expect(normalizeReferrer("direct") === "direct", "literal 'direct' -> direct", "")

expect(normalizeReferrer("https://www.google.com/search?q=foo") === "Google", "google.com -> Google", "")
expect(normalizeReferrer("https://www.google.co.in/") === "Google", "google.co.in -> Google", "")
expect(normalizeReferrer("https://l.facebook.com/l.php?u=https://example.com") === "Facebook", "l.facebook.com -> Facebook", "")
expect(normalizeReferrer("https://m.facebook.com/") === "Facebook", "m.facebook.com -> Facebook", "")
expect(normalizeReferrer("https://t.co/abc") === "X/Twitter", "t.co -> X/Twitter", "")
expect(normalizeReferrer("https://x.com/somepost") === "X/Twitter", "x.com -> X/Twitter", "")
expect(normalizeReferrer("https://www.linkedin.com/feed") === "LinkedIn", "linkedin.com -> LinkedIn", "")
expect(normalizeReferrer("https://lnkd.in/foo") === "LinkedIn", "lnkd.in -> LinkedIn", "")
expect(normalizeReferrer("https://www.youtube.com/watch?v=foo") === "YouTube", "youtube.com -> YouTube", "")
expect(normalizeReferrer("https://youtu.be/foo") === "YouTube", "youtu.be -> YouTube", "")
expect(normalizeReferrer("https://duckduckgo.com/?q=foo") === "DuckDuckGo", "duckduckgo -> DuckDuckGo", "")

const githubResult = normalizeReferrer("https://github.com/some/repo")
expect(githubResult === "GitHub", "github.com -> GitHub", `got=${githubResult}`)

const unknownDomain = normalizeReferrer("https://www.somerandomsite.example/path?q=1")
expect(unknownDomain === "somerandomsite.example", "unknown -> bare domain (www stripped)", `got=${unknownDomain}`)

const subdomain = normalizeReferrer("https://blog.someblogplatform.io/post/1")
expect(
  subdomain === "blog.someblogplatform.io",
  "unknown subdomain preserved (no www to strip)",
  `got=${subdomain}`,
)

expect(normalizeReferrer("not-a-url") === "unknown", "garbage -> unknown", "")

const phishingAttempt = normalizeReferrer("https://google.com.evil-site.example/")
expect(
  phishingAttempt !== "Google",
  "anchored matching: 'google.com.evil-site.example' is NOT classified as Google",
  `got=${phishingAttempt}`,
)

const stringIncludesGotcha = normalizeReferrer("https://googlefooblog.com/post")
expect(
  stringIncludesGotcha === "googlefooblog.com",
  "domain that includes 'google' but isn't google -> NOT classified as Google",
  `got=${stringIncludesGotcha}`,
)

console.log("\n=== extractClientIp (Fastify request shape) ===")

const ipv6mapped = extractClientIp({ ip: "::ffff:127.0.0.1" } as never)
expect(ipv6mapped === "127.0.0.1", "IPv4-mapped IPv6 -> bare IPv4", `got=${ipv6mapped}`)

const v4 = extractClientIp({ ip: "203.0.113.42" } as never)
expect(v4 === "203.0.113.42", "IPv4 passthrough", `got=${v4}`)

const v6 = extractClientIp({ ip: "2001:db8::1" } as never)
expect(v6 === "2001:db8::1", "IPv6 passthrough", `got=${v6}`)

const missing = extractClientIp({} as never)
expect(missing === "", "missing ip -> empty string", `got=${missing}`)

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed)
console.log(`\n=== SUMMARY: ${passed}/${results.length} passed ===`)
if (failed.length > 0) {
  console.log("\nFailures:")
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}
