import { ClickHouseClient } from '@clickhouse/client';

export type EventQueryParams = {
  workspaceId: string;
  eventName?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

/**
 * Fetches events for a specific workspace, enforcing tenant isolation.
 * 
 * @param client The ClickHouse client instance.
 * @param params Query parameters including the mandatory workspaceId.
 * @returns Array of events matching the criteria.
 */
export async function getEvents(client: ClickHouseClient, params: EventQueryParams) {
  if (!params.workspaceId) {
    throw new Error('workspaceId is required for tenant isolation');
  }

  let query = 'SELECT * FROM events WHERE workspace_id = {workspaceId: UUID}';
  const queryParams: Record<string, unknown> = {
    workspaceId: params.workspaceId,
  };

  if (params.eventName) {
    query += ' AND event_name = {eventName: String}';
    queryParams.eventName = params.eventName;
  }

  if (params.startDate) {
    query += ' AND created_at >= {startDate: DateTime64(3)}';
    queryParams.startDate = params.startDate.toISOString().replace('T', ' ').replace('Z', '');
  }

  if (params.endDate) {
    query += ' AND created_at <= {endDate: DateTime64(3)}';
    queryParams.endDate = params.endDate.toISOString().replace('T', ' ').replace('Z', '');
  }

  query += ' ORDER BY created_at DESC';

  if (params.limit) {
    query += ' LIMIT {limit: UInt32}';
    queryParams.limit = params.limit;
  }
  
  if (params.offset) {
    query += ' OFFSET {offset: UInt32}';
    queryParams.offset = params.offset;
  }

  const resultSet = await client.query({
    query,
    format: 'JSONEachRow',
    query_params: queryParams,
  });

  return await resultSet.json();
}

/**
 * Gets the total count of events for a given workspace.
 */
export async function getEventsCount(client: ClickHouseClient, workspaceId: string): Promise<number> {
  if (!workspaceId) {
    throw new Error('workspaceId is required for tenant isolation');
  }

  const resultSet = await client.query({
    query: 'SELECT count() as count FROM events WHERE workspace_id = {workspaceId: UUID}',
    format: 'JSONEachRow',
    query_params: {
      workspaceId,
    },
  });

  const data = await resultSet.json() as Array<{count: string | number}>;
  return data[0]?.count ? Number(data[0].count) : 0;
}
