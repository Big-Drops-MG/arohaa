# Dashboard Development Summary

This document summarizes the development work, architecture, and UI/UX improvements made across the various analytics dashboards. The dashboards pull data from both PostgreSQL (for structured metadata and A/B test definitions) and ClickHouse (for high-volume event, traffic, and analytics telemetry).

## 1. Traffic Dashboard

- **Purpose**: Provides a high-level overview of page views, unique visitors, bounce rates, and session durations.
- **Implementation**:
  - Implemented the `TrafficDashboard` component with dynamic data fetching using the `useDashboardDateRange` hook.
  - Built interactive KPI cards (boxes) that act as selectable tabs. When a user clicks a KPI, it updates the active state visually (turning the background black and text white) and displays relevant underlying chart data.
  - Implemented a smooth `transition-colors` effect and `hover:border-neutral-300 hover:bg-neutral-50/80` for inactive states to ensure a premium feel.

## 2. Funnel Dashboard

- **Purpose**: Visualizes user progression through multi-step flows (e.g., Landing Page -> Form Start -> Form Submit -> Success) and highlights drop-off points.
- **Implementation**:
  - Engineered the `FunnelDashboard` with interactive KPI row metrics, maintaining design parity with the Traffic dashboard.
  - Added visual trend badges to indicate period-over-period changes (e.g., +5% or -2%).
  - Configured Next.js server-side data loaders to securely fetch funnel aggregates from the internal analytics API.

## 3. Event Tracking Dashboard

- **Purpose**: Displays custom user events and interaction tracking data.
- **Implementation**:
  - Refactored `EventTrackingKpiRow` to support clickable interactions, ensuring the user experience matches the Traffic and Funnel pages.
  - Added React state (`activeKpiId`) to default the first KPI box to an active "black" state upon load.
  - Cleaned up the layout UI by removing the overarching grey background (`bg-neutral-50`) from the container, allowing the dashboard to blend naturally into the parent layout.

## 4. Segments Dashboard

- **Purpose**: Breaks down user behavior across various dimensions including geolocation, device type, and time of day.
- **Implementation**:
  - Upgraded the `SegmentsSummaryKpiRow` by adding `useState` to track the currently selected segment KPI.
  - Matched the styling of the segment boxes exactly to the Traffic page (`hover:border-neutral-300 hover:bg-neutral-50/80`).
  - Implemented auto-selection of the first KPI label on component mount and upon fetching new data ranges.
  - Stripped the `bg-neutral-50` class from the main layout wrapper for a cleaner, unified aesthetic.

## 5. Experiments Dashboard

- **Purpose**: Tracks A/B testing performance, allowing users to compare the conversion rates of different variants.
- **Implementation**:
  - **Database Integration**: Created the `experiment` schema in PostgreSQL to store test metadata (`id`, `landingPageId`, `name`, `status`, `variants`, `startDate`). We explicitly resolved Drizzle ORM conflicts and manually created the table to ensure the environment stayed stable.
  - **Backend API**: Built `analytics-experiments.service.ts` to query PostgreSQL for active experiments tied to specific landing pages.
  - **UI/UX**: Removed the grey background wrapper for consistency and implemented the Next.js API proxy route for client-side data fetching.

## 6. Alerts Dashboard

- **Purpose**: Proactively identifies and notifies users of anomalous behavior (e.g., sudden traffic spikes or severe drop-offs in form completion rates).
- **Implementation**:
  - **Heuristic Anomaly Detection**: Built `analytics-alerts.service.ts` to execute comparative queries against ClickHouse. It calculates metrics for the currently selected period versus the immediately preceding period.
  - **Alert Triggers**: Emits automated alerts for scenarios such as >20% traffic spikes, >20% traffic drops, >10% Form Submission Rate (FSR) drops, and >15% decreases in form starts.
  - **Frontend Integration**: Hooked the UI into the `useDashboardDateRange` context so alerts dynamically recalculate whenever the user changes the reporting timeframe. Added a 30-second background polling mechanism that pauses when the tab is inactive.

## 7. Data Processing Pipeline & Worker processing

- **Setup worker service**: Initialized a standalone Node.js process (`apps/worker/src/index.js`) separate from the Fastify API, establishing persistent connections to Redis and ClickHouse on startup.
- **Consume events from queue**: Created a continuous loop (using Redis BLPOP) to pull pending JSON payloads out of the `analytics_queue`.
- **Process events in batches**: Accumulated the consumed events into an in-memory array. Once the array hits 1,000 items OR 5 seconds have passed, it executes a bulk insert. PII masking (SHA-256 email hashing) is applied to each event.
- **Handle processing failures**: If the ClickHouse insertion fails, the worker catches the error, alerts Sentry, and pushes the failed batch into a Dead Letter Queue (`failed_events` list in Redis) to prevent data loss.
- **Insert processed events into database**: Extracted ClickHouse insertion queries into a dedicated module (`apps/worker/src/processor/dbWriter.js`), ensuring batch flushes match the expected schema.
- **Ensure data accuracy and consistency**: Implemented a validation step (`apps/worker/src/processor/validator.js`) just before adding to the batch. Events with missing required fields (`event_name`) or corrupted timestamps (`created_at`) are flagged and dropped to prevent corrupting analytics tables.
- **Implement workspace-based data separation**: Established strict routing logic in the validator (`apps/worker/src/processor/validator.js`). Every processed event must contain a valid `workspace_id`; otherwise, it is discarded immediately to prevent data mingling.
- **Apply filters for workspace data**: Created the foundational parameterized SQL queries (`packages/database/src/queries/events.ts`) that the Next.js Dashboard uses to fetch data. These functions explicitly include a `WHERE workspace_id = ?` clause to enforce tenant isolation during read operations.
- **Pipeline E2E Verification**: Created and executed an end-to-end verification script (`verify_pipeline.ts`) to simulate queue ingestion in Upstash Redis, spawn the worker, validate the successful dropping of invalid payloads, confirm PII hashing, and ensure structurally sound execution logic.

## Summary of Core Tech Stack

- **Frontend**: Next.js (App Router), React Server Components, TailwindCSS, `@workspace/ui` design system.
- **Backend APIs**: Fastify/Node.js, tRPC.
- **Databases**: PostgreSQL (via Drizzle ORM) for relational metadata; ClickHouse for time-series analytics and high-volume event tracking.
