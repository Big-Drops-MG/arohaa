import { and, eq } from 'drizzle-orm';
import { db, notifications } from '../index.js';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  severity?: string;
  landingPageId?: string | null;
  landingPagePublicId?: string | null;
  href?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
};

export async function createNotification(
  input: CreateNotificationInput,
): Promise<string | null> {
  const hasSource =
    input.sourceType != null &&
    input.sourceType.length > 0 &&
    input.sourceId != null &&
    input.sourceId.length > 0;

  if (hasSource) {
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.sourceType, input.sourceType!),
          eq(notifications.sourceId, input.sourceId!),
        ),
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }
  }

  const id = crypto.randomUUID();

  try {
    await db.insert(notifications).values({
      id,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'alert',
      landingPageId: input.landingPageId ?? null,
      landingPagePublicId: input.landingPagePublicId ?? null,
      href: input.href ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
    });
    return id;
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    const code = e?.code ?? e?.cause?.code;
    if (code === '23505' && hasSource) {
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, input.userId),
            eq(notifications.sourceType, input.sourceType!),
            eq(notifications.sourceId, input.sourceId!),
          ),
        )
        .limit(1);
      return existing?.id ?? null;
    }
    throw err;
  }
}
