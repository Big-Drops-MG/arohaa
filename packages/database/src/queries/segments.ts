import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { segments } from '../schema/segments.js';

export type SegmentInsert = typeof segments.$inferInsert;
export type SegmentSelect = typeof segments.$inferSelect;

export async function createSegment(data: SegmentInsert): Promise<SegmentSelect> {
  const [result] = await db.insert(segments).values(data).returning();
  if (!result) {
    throw new Error('Failed to create segment');
  }
  return result;
}

export async function getSegmentsByLandingPage(
  landingPageId: string,
): Promise<SegmentSelect[]> {
  return db
    .select()
    .from(segments)
    .where(eq(segments.landingPageId, landingPageId))
    .orderBy(segments.createdAt);
}

export async function getSegmentById(id: string): Promise<SegmentSelect | undefined> {
  const [result] = await db
    .select()
    .from(segments)
    .where(eq(segments.id, id));
  return result;
}

export async function updateSegment(
  id: string,
  landingPageId: string,
  data: Partial<Omit<SegmentInsert, 'id' | 'workspaceId' | 'landingPageId' | 'createdAt'>>
): Promise<SegmentSelect | undefined> {
  const [result] = await db
    .update(segments)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(segments.id, id), eq(segments.landingPageId, landingPageId)))
    .returning();
  return result;
}

export async function deleteSegment(
  id: string,
  landingPageId: string,
): Promise<SegmentSelect | undefined> {
  const [result] = await db
    .delete(segments)
    .where(and(eq(segments.id, id), eq(segments.landingPageId, landingPageId)))
    .returning();
  return result;
}
