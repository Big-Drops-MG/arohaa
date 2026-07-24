CREATE TABLE IF NOT EXISTS heatmap_events (
    workspace_id UUID,
    page_url String,
    event_type LowCardinality(String),
    timestamp DateTime64(3) DEFAULT now64(3),
    x Float64 DEFAULT 0,
    y Float64 DEFAULT 0,
    viewport_width Int32 DEFAULT 0,
    viewport_height Int32 DEFAULT 0,
    device LowCardinality(String) DEFAULT '',
    element_selector String DEFAULT '',
    properties String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (workspace_id, page_url, event_type, timestamp)
TTL toDateTime(timestamp) + toIntervalDay(180);

ALTER TABLE heatmap_events ADD COLUMN IF NOT EXISTS device LowCardinality(String) DEFAULT '';
ALTER TABLE heatmap_events MODIFY TTL toDateTime(timestamp) + toIntervalDay(180);

CREATE TABLE IF NOT EXISTS heatmap_clicks_rollup (
    workspace_id UUID,
    page_url String,
    device LowCardinality(String),
    day Date,
    grid_x Int32,
    grid_y Int32,
    clicks AggregateFunction(count)
) ENGINE = AggregatingMergeTree()
ORDER BY (workspace_id, page_url, device, day, grid_x, grid_y);

DROP VIEW IF EXISTS heatmap_clicks_mv;

CREATE MATERIALIZED VIEW IF NOT EXISTS heatmap_clicks_mv
TO heatmap_clicks_rollup
AS SELECT
    workspace_id,
    page_url,
    if(device != '', device, multiIf(viewport_width < 768, 'mobile', viewport_width < 1024, 'tablet', 'desktop')) AS device,
    toDate(timestamp) AS day,
    toInt32(floor(least(greatest(x, 0.), 1.) * 10.)) * 10 AS grid_x,
    toInt32(floor(least(greatest(y, 0.), 1.) * 10.)) * 10 AS grid_y,
    countState() AS clicks
FROM heatmap_events
WHERE event_type = 'click'
GROUP BY workspace_id, page_url, device, day, grid_x, grid_y;

CREATE TABLE IF NOT EXISTS heatmap_scroll_rollup (
    workspace_id UUID,
    page_url String,
    device LowCardinality(String),
    day Date,
    scroll_depth_bucket Int32,
    events AggregateFunction(count)
) ENGINE = AggregatingMergeTree()
ORDER BY (workspace_id, page_url, device, day, scroll_depth_bucket);

DROP VIEW IF EXISTS heatmap_scroll_mv;

CREATE MATERIALIZED VIEW IF NOT EXISTS heatmap_scroll_mv
TO heatmap_scroll_rollup
AS SELECT
    workspace_id,
    page_url,
    if(device != '', device, multiIf(viewport_width < 768, 'mobile', viewport_width < 1024, 'tablet', 'desktop')) AS device,
    toDate(timestamp) AS day,
    toInt32(floor(least(greatest(y, 0.), 1.) * 10.)) * 10 AS scroll_depth_bucket,
    countState() AS events
FROM heatmap_events
WHERE event_type = 'scroll'
GROUP BY workspace_id, page_url, device, day, scroll_depth_bucket;
