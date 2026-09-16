import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { db, webPushMediaAssets } from "@workspace/database"

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

export type WebPushMediaKind = "icon" | "badge" | "image"

function resolveMediaConfig(): {
  bucket: string
  region: string
  cdnBase: string | null
} | null {
  const bucket = process.env.WEB_PUSH_MEDIA_S3_BUCKET?.trim()
  if (!bucket) return null
  const region =
    process.env.WEB_PUSH_MEDIA_S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-1"
  const cdnBase =
    process.env.WEB_PUSH_MEDIA_CDN_BASE?.trim()?.replace(/\/$/, "") || null
  return { bucket, region, cdnBase }
}

export function isWebPushMediaUploadConfigured(): boolean {
  return resolveMediaConfig() != null
}

function extensionFor(contentType: string, fileName: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase()
  if (fromName && ["png", "jpg", "jpeg", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName
  }
  if (contentType === "image/png") return "png"
  if (contentType === "image/webp") return "webp"
  if (contentType === "image/gif") return "gif"
  return "jpg"
}

export async function uploadWebPushMedia(input: {
  landingPageId: string
  kind: WebPushMediaKind
  fileName: string
  contentType: string
  bytes: Buffer
}): Promise<
  | { ok: true; publicUrl: string; assetId: string }
  | { ok: false; status: number; error: string }
> {
  const config = resolveMediaConfig()
  if (!config) {
    return {
      ok: false,
      status: 503,
      error:
        "Media upload is not configured. Set WEB_PUSH_MEDIA_S3_BUCKET (and optional WEB_PUSH_MEDIA_CDN_BASE), or paste an HTTPS URL.",
    }
  }

  if (!ALLOWED_TYPES.has(input.contentType)) {
    return {
      ok: false,
      status: 400,
      error: "Only PNG, JPEG, WebP, or GIF images are allowed",
    }
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      status: 400,
      error: "Image must be between 1 byte and 2MB",
    }
  }

  const ext = extensionFor(input.contentType, input.fileName)
  const assetId = crypto.randomUUID()
  const storageKey = `web-push/${input.landingPageId}/${input.kind}/${assetId}.${ext}`

  const client = new S3Client({ region: config.region })
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: input.bytes,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  const publicUrl = config.cdnBase
    ? `${config.cdnBase}/${storageKey}`
    : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${storageKey}`

  await db.insert(webPushMediaAssets).values({
    id: assetId,
    landingPageId: input.landingPageId,
    kind: input.kind,
    fileName: input.fileName.slice(0, 200),
    contentType: input.contentType,
    byteSize: input.bytes.byteLength,
    publicUrl,
    storageKey,
    createdAt: new Date(),
  })

  return { ok: true, publicUrl, assetId }
}
