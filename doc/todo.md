# Backend TODO for Landing Page Storage

This document is for the backend developer who will implement persistent storage and secure production handling for landing pages created from the dashboard flow.

The goal is not only to save `brandName` and `landingPageUrl`, but to build a production-safe system that supports ownership, SDK installation, verification, event attribution, and future analytics features.

## 1. Core Product Goal

When a logged-in dashboard user adds a landing page, the backend should:

- create a durable landing page record in the database
- associate it with the correct owner / workspace / account boundary
- generate a stable public identifier that the SDK can use
- generate a secret or signed credential only if needed for future secure flows
- support verification that the SDK was actually installed on the claimed URL
- prevent cross-tenant access and spoofed connections
- allow future reporting, disable/re-enable flows, and auditability

## 2. First Confirm the Ownership Model

Before implementing schema, confirm the product-level ownership boundary.

Decide whether a landing page belongs to:

- a `user`
- a `team`
- a `workspace`
- or another tenant entity

Current code already has users in `packages/database/src/schema/auth.ts`, but no landing-page entity yet. Do not attach landing pages directly to a user unless the product is truly single-user forever.

Preferred production direction:

- introduce a tenant boundary such as `workspace` or `project`
- each landing page should belong to exactly one tenant
- users should access landing pages through membership/role rules, not direct ownership alone

If tenant modeling is not being added right now, at minimum:

- store `createdByUserId`
- store `updatedByUserId`
- prepare schema so it can later be migrated to workspace ownership cleanly

## 3. Database Schema Design

Create a new table for landing pages.

Recommended fields:

- `id`
  - internal primary key, UUID
- `publicId`
  - stable external identifier used by SDK, for example `lp_xxx`
  - unique, indexed
  - never use raw DB primary key in the frontend snippet
- `tenantId` or `workspaceId`
  - foreign key to ownership boundary
- `createdByUserId`
  - foreign key to user
- `updatedByUserId`
  - foreign key to user, nullable initially
- `brandName`
  - required
- `landingPageUrl`
  - required, canonical full URL
- `normalizedUrl`
  - required, normalized form for uniqueness and matching
- `origin`
  - extracted origin, for example `https://example.com`
- `hostname`
  - extracted hostname, for example `www.example.com`
- `status`
  - enum such as `draft | pending_verification | verified | inactive | archived`
- `sdkInstallStatus`
  - enum such as `not_installed | waiting | detected | failed`
- `verificationMethod`
  - enum such as `sdk_event | html_tag | dns | manual`
- `verifiedAt`
  - nullable timestamp
- `lastSeenAt`
  - last time valid SDK activity was observed
- `lastEventAt`
  - last ingest event tied to this landing page
- `notes`
  - nullable internal notes if needed
- `createdAt`
- `updatedAt`
- `deletedAt`
  - nullable soft-delete timestamp

Optional but useful:

- `expectedSdkVersion`
- `connectionErrorCode`
- `connectionErrorMessage`
- `metadata`
  - JSONB for controlled extensibility

## 4. Suggested Constraints and Indexes

Add production-grade constraints, not just columns.

Required constraints:

- unique index on `publicId`
- index on `tenantId`
- index on `createdByUserId`
- index on `hostname`
- index on `status`
- index on `lastSeenAt`

Recommended uniqueness strategy:

- unique on `(tenantId, normalizedUrl)` for active non-deleted records

This prevents the same tenant from registering the same landing page twice.

If partial indexes are supported in your migration setup, prefer:

- unique on `(tenantId, normalizedUrl)` where `deletedAt is null`

Validation constraints:

- `brandName` should not be empty after trim
- `landingPageUrl` must be a valid URL
- `hostname` and `origin` must be derived by the backend, not trusted from the client
- enum columns must be enforced at DB or schema-validation level

## 5. URL Canonicalization Rules

Do not trust raw URLs from the frontend. Normalize on the backend before storage.

At minimum:

- trim whitespace
- require `http` or `https`
- reject unsupported protocols such as `javascript:`, `file:`, `data:`
- lowercase hostname
- remove default ports (`:80`, `:443`) when appropriate
- remove fragment/hash
- decide how query params should be handled
  - if the landing page identity is page-level, usually strip query params
  - if query params matter, store both raw and canonical forms
- decide how trailing slashes are handled

Store both:

- `landingPageUrl` as accepted/display value
- `normalizedUrl` as canonical matching value

Reason:

- verification and SDK matching logic becomes much safer and more deterministic

## 6. API Endpoints to Build

The frontend flow will eventually need real backend APIs.

Recommended endpoints:

1. `POST /landing-pages`
   - create a new landing page
   - input: `brandName`, `landingPageUrl`
   - output: saved record + generated SDK payload data

2. `GET /landing-pages/:publicId`
   - fetch a single landing page for authorized user

3. `PATCH /landing-pages/:publicId`
   - update editable fields safely

4. `POST /landing-pages/:publicId/check-connection`
   - trigger verification attempt
   - return current connection state

5. `GET /landing-pages/:publicId/connection-status`
   - pollable endpoint for frontend step 3

6. `POST /landing-pages/:publicId/archive`
   - soft delete / archive

7. `GET /landing-pages`
   - list pages for current tenant with filtering

Keep request/response DTOs strict and versionable.

## 7. Authentication and Authorization

All landing-page management endpoints must be authenticated.

Minimum rules:

- user must be logged in
- user must belong to the tenant that owns the landing page
- user must have permission to create/edit/archive the landing page

Production expectations:

- never query by `publicId` alone and then return the row without tenant scoping
- always scope reads and writes by both tenant and resource identifier
- reject access with generic authorization errors
- log authorization failures with safe metadata

If roles are added later, prepare now for:

- `owner`
- `admin`
- `editor`
- `viewer`

Suggested permission model:

- `owner/admin`: create, edit, verify, archive
- `editor`: create, edit, verify
- `viewer`: read only

## 8. SDK Identifier Strategy

The current frontend mock uses a `data-project-id` style attribute. Do not expose internal identifiers casually.

Use a dedicated public identifier:

- `publicId` like `lp_...`
- generated server-side
- immutable after creation

Do not use:

- incremental IDs
- raw UUID primary key if you want cleaner external contracts

If future security requires signed installation metadata, consider:

- a short-lived signed token for install verification
- a server-generated HMAC/JWT scoped to that landing page

But do not overcomplicate the first version if the SDK is public and analytics are non-sensitive.

## 9. Secure Verification Model

The hardest production problem is proving the user actually controls the landing page they entered.

Do not treat "user entered URL" as proof of ownership.

At least one verification strategy should exist:

### Option A: SDK event based detection

Flow:

- backend creates landing page with `publicId`
- frontend shows SDK snippet containing that identifier
- user installs snippet on their page
- when real page loads, SDK sends event including landing page `publicId`
- backend marks landing page as detected/verified only if event comes from expected normalized URL/origin

Requirements:

- ingest payload must include landing-page identifier
- backend must compare event `url/origin/hostname` against stored normalized values
- record first successful detection timestamp

### Option B: HTML meta tag or script token verification

Flow:

- backend issues verification token
- user places token in page `<meta>` or script
- backend fetches claimed page server-side and verifies token presence

This is useful if you do not want to wait for SDK traffic.

### Option C: DNS verification

Best for higher-trust enterprise flows, but probably unnecessary for first version.

Recommendation for v1:

- start with SDK event detection
- add optional HTML token verification later if needed

## 10. Ingest Pipeline Changes Needed

The current ingest route in `apps/api/src/routes/ingest.ts` validates `wid`, `sid`, `uid`, and optional page fields, but there is no landing-page specific linkage yet.

Backend TODO:

- extend ingest schema to include landing-page identifier, for example `projectId` or `landingPageId`
- validate format strictly
- resolve that identifier to an existing active landing page
- reject or quarantine invalid identifiers
- compare incoming page URL/origin with stored canonical values
- update `lastSeenAt` and `lastEventAt` on successful matched ingestion
- optionally update `sdkInstallStatus` from `waiting` to `detected`

Be careful:

- do not allow any arbitrary client to attach events to any landing page ID without validation
- do not let identifier mismatches silently create false positive connections

## 11. Abuse Prevention and Security Controls

Treat this as internet-facing.

Add:

- rate limiting on create/update/check endpoints
- tenant-level quotas
- validation of URL length and brand-name length
- sanitization for any text later shown in UI
- server-side parsing only for URL-derived fields
- request logging with trace IDs
- suspicious activity detection for repeated invalid connection checks

Specific constraints:

- max brand length, for example 120
- max URL length, for example 2048
- reject internal/private network verification targets if backend fetching is introduced
  - prevent SSRF
- if using server-side fetch for verification:
  - block `localhost`
  - block link-local/private IPs
  - block cloud metadata IPs
  - enforce timeout and redirect limits
  - only allow `http/https`

## 12. Secrets and Token Handling

If verification tokens or signing secrets are introduced:

- never store plaintext secrets in frontend code
- keep signing secret in server env only
- rotate secrets safely
- separate public identifiers from secret verification material
- hash one-time verification tokens if they must be persisted

Do not confuse:

- public install identifier
- private signing secret
- auth session identity

Each serves a different purpose.

## 13. Auditability

For production, record sensitive changes.

Track at least:

- who created the landing page
- who updated it
- old URL to new URL changes
- verification status transitions
- archive/unarchive actions

Suggested audit log fields:

- actorUserId
- tenantId
- entityType
- entityId
- action
- before
- after
- traceId
- createdAt

This can be a dedicated audit table or centralized audit pipeline.

## 14. Observability and Ops

Add visibility before release.

Required telemetry:

- count of landing page creates
- count of connection checks
- count of successful verifications
- count of failed verifications
- verification latency
- ingest events rejected for bad landing-page IDs
- tenant-level error rates

Log with structured fields:

- `tenantId`
- `publicId`
- `hostname`
- `traceId`
- `userId`
- result/status

Add alerts for:

- spike in failed connection checks
- spike in invalid IDs from ingest
- verification job failures

## 15. Background Jobs / Async Work

If verification is not instant, use async jobs instead of long synchronous requests.

Examples:

- poll for SDK detection after user clicks "Check Connection"
- retry verification with bounded backoff
- expire stale pending-verification records
- recalculate health/status fields

Suggested lifecycle:

- `draft`
- `pending_verification`
- `verified`
- `verification_failed`
- `inactive`
- `archived`

## 16. Frontend Contract Expectations

The frontend multi-step form should not generate authoritative IDs on its own.

Backend should return the canonical payload needed for snippet generation, for example:

- `publicId`
- canonical `landingPageUrl`
- script/snippet config values
- current connection status

Preferred flow:

1. user submits step 1
2. backend creates landing page row
3. backend returns persisted data + generated SDK install values
4. frontend renders step 2 using backend response
5. frontend calls backend to check connection
6. backend returns authoritative connection status

## 17. Migrations and Backward Compatibility

Implementation should include:

- migration file for new table
- indexes in same migration where appropriate
- backfill strategy if ownership model changes later
- safe enum evolution plan

Do not rely on ad hoc schema changes directly in code only.

## 18. Testing Requirements

Production-level work is incomplete without tests.

Add:

- unit tests for URL normalization
- unit tests for identifier generation format
- integration tests for create endpoint
- authorization tests across tenants
- verification logic tests
- ingest matching tests
- SSRF protection tests if backend fetch verification is implemented
- migration smoke test if your workflow supports it

Critical cases to test:

- same URL twice for same tenant
- same URL across different tenants
- mixed-case hostname
- trailing slash normalization
- malicious URL protocol
- unauthorized user reading another tenant page
- spoofed landing-page identifier in ingest event

## 19. Rollout Plan

Recommended rollout order:

1. add schema and migration
2. add create/list/get endpoints
3. add authorization enforcement
4. add canonical URL normalization
5. add SDK identifier support in backend response
6. add ingest linkage
7. add connection verification endpoint
8. add status transitions and audit logging
9. add dashboards/alerts
10. release behind feature flag if possible

## 20. Definition of Done

This feature should be considered production-ready only when:

- landing page records are persisted with tenant-safe ownership
- URLs are normalized and validated server-side
- duplicate registration is prevented appropriately
- SDK install uses a stable backend-generated public identifier
- connection verification is backed by real backend logic
- ingest events are safely linked to landing pages
- authorization is enforced on every endpoint
- audit logs and observability exist
- abuse and SSRF risks are handled
- tests cover core happy path and high-risk failure paths

## 21. Practical First Implementation Recommendation

If you want a strong but realistic v1, build this first:

- one `landing_pages` table
- `publicId`, `brandName`, `landingPageUrl`, `normalizedUrl`, `hostname`, `origin`, `status`, `sdkInstallStatus`, `createdByUserId`, `createdAt`, `updatedAt`
- create/list/get endpoints
- tenant scoping if available, otherwise user scoping with future migration path
- backend-generated SDK payload
- ingest event linkage using `publicId`
- connection verification based on real detected event from expected URL
- strict validation + rate limiting
- audit log for create/update/archive

Avoid shipping a version where:

- the frontend invents authoritative IDs
- verification is only simulated
- any user can claim any URL without validation
- cross-tenant reads are possible
- URLs are stored raw without normalization
