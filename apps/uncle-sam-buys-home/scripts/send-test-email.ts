import { config } from "dotenv"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
config({ path: resolve(root, ".env") })

const to = process.argv[2] ?? "samiwasta.11@gmail.com"

async function main() {
  const { sendSubmissionConfirmationEmail } = await import("../lib/send-submission-email.js")
  const ok = await sendSubmissionConfirmationEmail({
    to,
    firstName: "Sami",
    lastName: "Test",
  })
  if (!ok) {
    console.error("Email was not sent (check env, SES, or logs above).")
    process.exit(1)
  }
  console.log(`Sent test confirmation email to ${to}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
