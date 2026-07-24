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
