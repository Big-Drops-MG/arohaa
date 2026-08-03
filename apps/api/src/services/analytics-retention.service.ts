import { getClickHouseClient } from './clickhouse.service.js';
import { SegmentCompiler, type SegmentGroup } from './segment-compiler.service.js';

export type CohortRetentionRow = {
  cohort_week: string;
  channel?: string;
  week_number: number;
  active_users: number;
};

export async function getCohortRetention(
  workspaceId: string,
  segmentGroup: SegmentGroup | null,
  splitBy?: 'utm_source' | 'utm_campaign'
): Promise<CohortRetentionRow[]> {
  const client = getClickHouseClient();
  const compiler = new SegmentCompiler();
  const compiledSegment = compiler.compile(segmentGroup);

  const selectChannel = splitBy 
    ? `, multiIf(empty(argMin(${splitBy}, created_at)) OR isNull(argMin(${splitBy}, created_at)), 'Direct', argMin(${splitBy}, created_at)) AS channel` 
    : '';

  const query = `
    WITH user_first_seen AS (
        SELECT 
            COALESCE(nullIf(user_id, ''), nullIf(fingerprint, ''), session_id) AS vid,
            toStartOfWeek(min(created_at), 1) AS cohort_week
            ${selectChannel}
        FROM events_raw
        WHERE workspace_id = {workspaceId: UUID}
          AND ${compiledSegment.sql}
        GROUP BY vid
    ),
    user_activity AS (
        SELECT 
            COALESCE(nullIf(user_id, ''), nullIf(fingerprint, ''), session_id) AS vid,
            toStartOfWeek(created_at, 1) AS activity_week
        FROM events_raw
        WHERE workspace_id = {workspaceId: UUID}
          AND ${compiledSegment.sql}
        GROUP BY vid, activity_week
    )
    SELECT 
        formatDateTime(c.cohort_week, '%Y-%m-%d') AS cohort_week
        ${splitBy ? ', c.channel AS channel' : ''},
        dateDiff('week', c.cohort_week, a.activity_week) AS week_number,
        count(DISTINCT a.vid) AS active_users
    FROM user_first_seen c
    JOIN user_activity a ON c.vid = a.vid
    WHERE week_number >= 0 AND week_number <= 8
    GROUP BY c.cohort_week${splitBy ? ', c.channel' : ''}, week_number
    ORDER BY c.cohort_week DESC${splitBy ? ', c.channel ASC' : ''}, week_number ASC
  `;

  const resultSet = await client.query({
    query,
    format: 'JSONEachRow',
    query_params: {
      workspaceId,
      ...compiledSegment.params,
    },
  });

  const rawRows = (await resultSet.json()) as Array<{ cohort_week: string; channel?: string; week_number: string | number; active_users: string | number }>;
  
  return rawRows.map(row => ({
    cohort_week: row.cohort_week,
    ...(row.channel !== undefined ? { channel: row.channel } : {}),
    week_number: Number(row.week_number),
    active_users: Number(row.active_users)
  }));
}
