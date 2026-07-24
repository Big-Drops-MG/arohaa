DROP VIEW IF EXISTS heatmap_clicks_mv;
DROP VIEW IF EXISTS heatmap_scroll_mv;

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

CREATE TABLE IF NOT EXISTS heatmap_section_rollup (
    workspace_id UUID,
    page_url String,
    device LowCardinality(String),
    day Date,
    element_selector String,
    dwell_ms AggregateFunction(sum, Float64),
    views AggregateFunction(count)
) ENGINE = AggregatingMergeTree()
ORDER BY (workspace_id, page_url, device, day, element_selector);

DROP VIEW IF EXISTS heatmap_section_mv;

CREATE MATERIALIZED VIEW IF NOT EXISTS heatmap_section_mv
TO heatmap_section_rollup
AS SELECT
    workspace_id,
    page_url,
    if(device != '', device, multiIf(viewport_width < 768, 'mobile', viewport_width < 1024, 'tablet', 'desktop')) AS device,
    toDate(timestamp) AS day,
    element_selector,
    sumState(JSONExtractFloat(properties, 'dwell_ms')) AS dwell_ms,
    countState() AS views
FROM heatmap_events
WHERE event_type = 'section' AND element_selector != ''
GROUP BY workspace_id, page_url, device, day, element_selector;
