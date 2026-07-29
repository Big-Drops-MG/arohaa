import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { segments } from '../schema/segments.js';

export type SegmentInsert = typeof segments.$inferInsert;
export type SegmentSelect = typeof segments.$inferSelect;

export async function createSegment(data: SegmentInsert): Promise<SegmentSelect> {
  const [result] = await db.insert(segments).values(data).returning();
  return result!;
}

export async function getSegmentsByWorkspace(workspaceId: string): Promise<SegmentSelect[]> {
  return db
    .select()
    .from(segments)
    .where(eq(segments.workspaceId, workspaceId))
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
  workspaceId: string,
  data: Partial<Omit<SegmentInsert, 'id' | 'workspaceId' | 'createdAt'>>
): Promise<SegmentSelect | undefined> {
  const [result] = await db
    .update(segments)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(segments.id, id), eq(segments.workspaceId, workspaceId)))
    .returning();
  return result;
}

export async function deleteSegment(id: string, workspaceId: string): Promise<SegmentSelect | undefined> {
  const [result] = await db
    .delete(segments)
    .where(and(eq(segments.id, id), eq(segments.workspaceId, workspaceId)))
    .returning();
  return result;
}
