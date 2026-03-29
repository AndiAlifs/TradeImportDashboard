# L/C Processing Time Tracker
# Product Requirements Document (As Built)

## 1. Document Control

- Version: 3.0 (rewrite — aligned to implemented codebase)
- Last updated: 2026-03-29
- Scope: current implementation in this repository
- Purpose: define implemented behavior and separate roadmap-only capabilities

## 2. Executive Summary

The L/C Processing Time Tracker is an internal Trade Finance operations system for tracking Import and Export L/C processing performance. The product provides lifecycle visibility, SLA monitoring, role-scoped execution, real-time updates, in-app notifications, and period-over-period SLA comparison for operational and executive users.

The current product is a manual-intake workflow. Automated inbox ingestion and backend LLM-generated summaries are target-state capabilities and are not implemented in this codebase.

## 3. Product Mission

The product exists to improve operational control and management visibility by:

1. Capturing lifecycle timestamps for every L/C order.
2. Enabling low-friction status progression by operations users.
3. Measuring SLA adherence and identifying breaches early.
4. Comparing Import and Export processing performance to expose bottlenecks.
5. Providing period-over-period SLA compliance trend comparison.
6. Tracking individual exception instances with full history.
7. Surfacing proactive notifications for at-risk and newly created L/Cs.

## 4. Users and Access Model

### 4.1 Personas

1. Operations Staff (Import or Export): create and process records within assigned transaction scope.
2. Operations Officer (Import or Export): same as staff plus release capability and master-data access.
3. Executive: read-heavy visibility across streams, event log access, SLA configuration access, master data management.
4. Super Admin: full access including data reset.

### 4.2 Implemented RBAC Model

RBAC is currently mock-based, enforced by both frontend route/menu guards and backend authorization middleware.

- Roles: `super_admin`, `executive`, `import_officer`, `import_staff`, `export_officer`, `export_staff`
- Scope: All, Import, Export (derived from role)
- Request headers: `X-Mock-Role`, `X-Mock-Scope`, `X-Mock-User`
- Role switching: available in sidebar via dropdown (persisted in localStorage)
- Route guard: `mockRbacGuard` checks `canAccessPath` before navigation

### 4.3 Role-Permission Matrix

| Action | super_admin | executive | *_officer | *_staff |
| --- | --- | --- | --- | --- |
| View executive dashboard | ✅ | ✅ | ✅ | ✅ |
| View own-stream operations | ✅ | — | ✅ | ✅ |
| Create L/C | ✅ | — | ✅ | ✅ |
| Update status | ✅ | — | ✅ | ✅ |
| Release L/C | ✅ | — | ✅ | — |
| Manage assignees | ✅ | ✅ | ✅ | — |
| Manage officers | ✅ | ✅ | — | — |
| Manage SLA config | ✅ | ✅ | — | — |
| View event log | ✅ | ✅ | — | — |
| Reset all data | ✅ | ✅ | — | — |

## 5. Current Scope (Implemented)

### 5.1 L/C Intake and Lifecycle

1. Manual creation is supported via UI and API.
2. Required creation payload includes: `urn`, `subject`, `transactionType`, `assignedTo`, `receivedAt`.
3. URN must be unique (enforced via database unique index).
4. Initial status is `Received`.
5. Supported statuses:
   - `Received`
   - `Drafting`
   - `Checking Underlying`
   - `Released`
   - `Exception`
   - `Breached`
   - `Breached with Exception`
6. Supported queue actions:
   - Start Drafting (Received → Drafting)
   - Start Checking Underlying (Drafting → Checking Underlying)
   - Release (Checking Underlying → Released; officer or super_admin only)
   - Mark Exception (any active status → Exception, stores `previousStatus`)
   - Resolve Exception (Exception → user-selected destination status: Received, Drafting, Checking Underlying, Released, Breached, or Breached with Exception)
   - Mark Breached (Checking Underlying → Breached)
   - Mark Breached with Exception (Checking Underlying → Breached with Exception)
   - Backward transitions: Drafting → Received, Checking Underlying → Drafting
7. Officer approval: Release action records `approvedBy` (officer name from dropdown).
8. Toast warning displayed when attempting to release without selecting an officer.

### 5.2 Status Transition Matrix

| From \ To | Received | Drafting | Checking Underlying | Released | Breached | Breached w/ Exception | Exception |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Received | — | ✅ | — | — | — | — | ✅ |
| Drafting | ✅ | — | ✅ | — | — | — | ✅ |
| Checking Underlying | — | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| Breached | — | — | ✅ | ✅ | — | — | ✅ |
| Breached w/ Exception | — | — | ✅ | ✅ | — | — | ✅ |
| Exception | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |

### 5.3 Event Capture and Auditability

1. Every create/status transition writes an event record.
2. Event details include: `lcId`, `urn`, `action`, `user`, `from` status, `to` status, `notes`, `timestamp`.
3. Event log is accessible for executive and super_admin roles.
4. Recent activity feed (last 8 events) displayed on executive dashboard.

### 5.4 Exception Handling (Multiple Exceptions)

1. Each L/C supports multiple sequential exceptions tracked in a dedicated `lc_exceptions` table.
2. Each exception record captures: `lcId`, `reason`, `startedAt`, `resolvedAt`, `resolutionMinutes`, `resolvedToStatus`, `resolvedBy`.
3. When marking an exception, the system records `previousStatus` on the L/C and creates a new `LCException` row.
4. When resolving, the user selects a destination status. The system:
   - Calculates resolution minutes (auto-computed or user-specified).
   - Updates the `LCException` record with resolution details.
   - Adds the delta to `exceptionTotalMinutes` on the L/C.
5. Exception history is viewable in the L/C detail modal (table with start, reason, resolved, duration, returned-to columns).
6. Total exception minutes are deducted from effective SLA elapsed time.

### 5.5 SLA and Timing

1. A single global SLA configuration is implemented: `slaMaxMinutes` (default 120).
2. Effective elapsed time calculation:
   - For released L/Cs: `releasedAt − receivedAt − exceptionTotalMinutes`
   - For exception L/Cs: `exceptionStartedAt − receivedAt − exceptionTotalMinutes`
   - For active L/Cs: `now − receivedAt − exceptionTotalMinutes`
3. **Breach classification**: A record is considered breached when effective elapsed time exceeds `slaMaxMinutes` AND the record is not in Released or Exception status, OR when status is explicitly `Breached` or `Breached with Exception`.
4. **SLA warning threshold**: 75% of `slaMaxMinutes` triggers notification alerts for at-risk L/Cs.
5. SLA configuration is restricted to authorized roles (super_admin, executive).

### 5.6 Import and Export Stream Separation

1. Each L/C has `transactionType` = `Import` or `Export`.
2. Import and Export have separate route entry points and operational views:
   - Import: `/import`, `/import/queue`, `/import/all`, `/import/create`
   - Export: `/export`, `/export/queue`, `/export/all`, `/export/create`
3. Backend scope enforcement prevents cross-stream access for scoped users.
4. Sidebar navigation groups Import and Export operations into labeled sections.

### 5.7 Dashboards and Analytics

#### 5.7.1 Executive Dashboard (`/`)

1. **Date range toolbar**: Preset filters (Today, Yesterday, Last 7 Days, Last 14 Days, Last Month) and custom date range picker.
2. **SLA period comparison panel**: Current vs. previous equivalent period comparison with:
   - Overall, Import, and Export SLA compliance percentages.
   - Visual bars and trend indicators (up/down/flat with percentage-point deltas).
   - Filterable by metric (Overall, Import, Export, or All).
3. **KPI cards**: Import processed, Export processed, Import SLA%, Export SLA%, Total breaches, Average cycle time.
4. **Import vs Export comparison chart**: Side-by-side stage-duration bar chart for Inbox, Drafting, Checking Underlying, and Total stages.
5. **Bottleneck panel**: Identifies longest stage per stream, gap to second-longest, and cross-stream delta.
6. **AI Summary card**: Deterministic rule-based narrative (labeled "AI Generated" in UI) with:
   - Overall health indicator (Excellent/Moderate/Critical based on compliance thresholds).
   - Overview, Import performance, Export performance sections.
   - Actionable recommendation based on breach distribution and volume imbalance.
7. **Staff & Officer performance table**: Per-person stats (name, role, volume, breaches, compliance%, avg time) with clickable breach drill-down.
8. **Combined recent activity table**: Last 8 events across all streams.

#### 5.7.2 Operations Dashboard (`/import`, `/export`)

1. Per-stream KPI cards: active, completed, breaches, average time.
2. Date range filtering synced with operations date range state.
3. Stage-duration analytics implemented.

#### 5.7.3 Queue View (`/import/queue`, `/export/queue`)

1. Actionable queue with status transition buttons.
2. Officer selection dropdown for release action.
3. Exception marking with reason input and resolution with destination status selection.
4. L/C detail modal with full timeline, stage duration chart, stage share visualization, and exception history.

#### 5.7.4 All L/Cs View (`/import/all`, `/export/all`)

1. Tabular view of all L/Cs within the selected date range and stream scope.
2. Searchable and filterable.
3. L/C detail modal accessible from row click.

### 5.8 L/C Detail Modal

A unified modal used across Executive Dashboard, Queue, All LCs, and Notifications. Contents:

1. **Header**: URN, transaction type, subject.
2. **Timeline**: Visual step-by-step timeline showing Received → Drafting → Checking Underlying → Exception (if any) → Released, with timestamps and descriptions.
3. **Stage duration card**: Bar chart of time spent in each stage with bottleneck indicator.
4. **Stage share visualization**: Stacked bar showing proportional time in each stage with legend.
5. **Exception history table**: All exception instances for the L/C (if any), showing start, reason, resolved, duration, and returned-to status.

### 5.9 Notification System

1. **SLA warning alerts**: Triggered when a non-terminal L/C reaches 75% of SLA max time.
2. **New L/C notifications**: Top 3 most recent L/C creations within the last 24 hours.
3. **System announcements**: Static system-level notification (cut-off reminder).
4. **Notification bell**: Topbar icon with unread count badge.
5. **Notification dropdown**: Categorized items (alert/info/system) with mark-as-read and mark-all-as-read functionality.
6. **Notification click**: Clicking a warning/new-LC notification opens the L/C detail modal.
7. **Dismissal persistence**: Dismissed notification IDs stored in localStorage.

### 5.10 Real-Time Update Behavior

1. Backend exposes SSE stream via `/api/events/stream` with event type `lc_update`.
2. Frontend subscribes via `EventSource` and refreshes data on incoming events (with 500ms debounce).
3. Streaming uses pub/sub broadcaster pattern — non-blocking, drops events for slow subscribers.
4. Automatic reconnection with 3-second backoff on connection failure.
5. Realtime sync can be started/stopped programmatically.

### 5.11 Master Data Management

1. **Assignees**: Full CRUD (list, create, get, update, delete) for operations staff.
2. **Officers**: Full CRUD (list, create, get, update, delete) for approving officers.
3. Both entities have `name`, `isActive` status, and timestamps.
4. Accessible at `/assignee-master` and `/officer-registration`.
5. Access restricted by role (see permission matrix).

### 5.12 Data Seeding

1. Database auto-migrates on startup (GORM AutoMigrate).
2. Default SLA config seeded (120 minutes).
3. Default assignees seeded (5 records).
4. Default officers seeded (3 records).
5. Default L/C records seeded (30 total: 15 Import + 15 Export) with distribution:
   - 2 Released within SLA per stream
   - 3 Breached per stream
   - 5 Checking Underlying per stream
   - 5 Drafting per stream
6. Corresponding event log entries seeded for each L/C.

### 5.13 Platform and UX

1. Frontend: Angular 19+ standalone components with signals-based reactivity.
2. Backend: Go (Gin + GORM).
3. Database: MySQL.
4. i18n: English and Indonesian with frontend language toggle (persisted in localStorage).
5. Translation: Custom `TranslationService` with `TranslatePipe` for template use.
6. Local fallback: frontend uses localStorage when backend connectivity is unavailable (caches LCs, SLA config, events, assignees, officers).
7. Live clock display in topbar.
8. Responsive sidebar with hamburger toggle for mobile.
9. Backend API base configurable via `window.SHILA_API_BASE` (default: `http://localhost:8081/api`).

## 6. Data Model

### 6.1 LC Table (`lcs`)

| Field | Type | Notes |
| --- | --- | --- |
| id | uint64 | Primary key, auto-increment |
| urn | string(32) | Unique index, required |
| senderEmail | string(255) | Required |
| subject | string(500) | — |
| transactionType | string(16) | Required (Import/Export) |
| status | string(64) | Default: Received |
| assignedTo | string(100) | Staff assignee name |
| receivedAt | datetime | Required |
| draftingStartedAt | datetime | Nullable |
| checkingStartedAt | datetime | Nullable |
| releasedAt | datetime | Nullable |
| exceptionStartedAt | datetime | Nullable |
| exceptionResolvedAt | datetime | Nullable |
| exceptionTotalMinutes | int | Default: 0, accumulated |
| exceptionReason | text | Nullable |
| previousStatus | string(64) | Nullable, set on exception |
| approvedBy | string(100) | Nullable, officer name |
| createdAt | datetime | Auto |
| updatedAt | datetime | Auto |

### 6.2 LCException Table (`lc_exceptions`)

| Field | Type | Notes |
| --- | --- | --- |
| id | uint64 | Primary key, auto-increment |
| lcId | uint64 | Foreign key, indexed |
| reason | text | Required |
| startedAt | datetime | Required |
| resolvedAt | datetime | Nullable |
| resolutionMinutes | int | Nullable |
| resolvedToStatus | string(64) | Nullable |
| resolvedBy | string(100) | Nullable |
| createdAt | datetime | Auto |
| updatedAt | datetime | Auto |

### 6.3 Event Table (`events`)

| Field | Type | Notes |
| --- | --- | --- |
| id | uint64 | Primary key, auto-increment |
| lcId | uint64 | Indexed |
| urn | string(32) | Indexed |
| user | string(100) | Acting user |
| action | string(100) | Required |
| from | string(64) | Previous status |
| to | string(64) | New status |
| notes | text | — |
| timestamp | datetime | Required, indexed |
| createdAt | datetime | Auto |

### 6.4 SLAConfig Table (`sla_config`)

| Field | Type | Notes |
| --- | --- | --- |
| id | uint64 | Primary key |
| slaMaxMinutes | int | Default: 120 |
| createdAt | datetime | Auto |
| updatedAt | datetime | Auto |

### 6.5 Assignee/Officer Tables (`assignees`, `officers`)

| Field | Type | Notes |
| --- | --- | --- |
| id | uint64 | Primary key |
| name | string(100) | Unique index, required |
| isActive | bool | Default: true |
| createdAt | datetime | Auto |
| updatedAt | datetime | Auto |

## 7. Current vs Target State

| Capability | Current State | Target State |
| --- | --- | --- |
| Intake source | Manual create form/API | Automated email ingestion with parser/orchestration |
| URN generation | Provided by client/user | Generated by ingestion pipeline and policy |
| SLA configuration | Single global slaMaxMinutes | SLA profiles by transaction type and policy |
| Executive narrative summary | Rule-based deterministic frontend text | Backend-assisted LLM summary with controls |
| Trend analytics | Period comparison snapshots and stage comparisons | Time-series trend views and longitudinal analysis |
| Authentication | Mock RBAC via request headers | Production identity provider with server-issued claims |

## 8. Functional Requirements

### FR-1 L/C Record Management

1. System shall allow manual creation of L/C records with URN, subject, transactionType, assignedTo, and receivedAt.
2. System shall enforce URN uniqueness via database constraint.
3. System shall persist lifecycle timestamps used for SLA analytics.
4. System shall support assignee assignment on creation.

### FR-2 Status Lifecycle Control

1. System shall validate legal status transitions per the implemented transition matrix.
2. System shall record an event for each transition including action, from/to status, user, and notes.
3. System shall restrict release transitions to officer/super-admin roles.
4. System shall record `approvedBy` officer on release.
5. System shall support backward transitions (Drafting → Received, Checking → Drafting).

### FR-3 Exception Handling

1. System shall support marking records as Exception from any active status with optional reason.
2. System shall create a new `LCException` record for each exception instance.
3. System shall store `previousStatus` on the L/C when entering exception state.
4. System shall support resolving exceptions with user-selected destination status.
5. System shall calculate exception resolution minutes (auto-computed from duration or user-specified).
6. System shall accumulate exception minutes on the L/C record.
7. System shall deduct total exception time from effective SLA elapsed calculations.
8. System shall provide exception history retrieval per L/C.

### FR-4 SLA Configuration

1. System shall support configurable global SLA max minutes.
2. System shall classify records into compliant/breached outcomes.
3. System shall support "Breached with Exception" status for records breached after exception deduction.
4. System shall restrict SLA updates to authorized roles.

### FR-5 Role and Scope Authorization

1. System shall enforce role-gated actions and route visibility.
2. System shall enforce scope boundaries between Import and Export for scoped roles.
3. System shall support mock role headers for development mode.
4. Frontend route guard shall redirect unauthorized navigation to default route.
5. Sidebar shall dynamically show/hide menu items based on current role.

### FR-6 Operational and Executive Visibility

1. System shall show per-stream and combined KPI cards.
2. System shall show stage-duration comparisons and bottleneck indicators.
3. System shall show event logs for governance and operations review.
4. System shall provide period-over-period SLA compliance comparison.
5. System shall show staff and officer performance metrics.
6. System shall show deterministic rule-based narrative summary card.

### FR-7 Notifications

1. System shall generate SLA warning notifications when L/Cs reach 75% of SLA threshold.
2. System shall generate new L/C notifications for recent creations (top 3, last 24 hours).
3. System shall support notification dismissal (mark as read, mark all as read).
4. System shall open L/C detail modal when clicking a notification with URN context.
5. Notification state shall be persisted in localStorage.

### FR-8 Real-Time Refresh

1. Backend shall publish L/C update notifications over SSE.
2. Frontend shall refresh state after receiving stream updates with debounced refresh.
3. SSE broadcaster shall not block core API traffic.

### FR-9 Date Range Filtering

1. System shall support preset date range filters (Today, Yesterday, Last 7 Days, Last 14 Days, Last Month).
2. System shall support custom date range filtering with from/to date inputs.
3. Date ranges shall be applied independently for executive and operations dashboard contexts.
4. Date range selections shall be persisted in localStorage.
5. Backend shall support `preset`, `fromDate`, and `toDate` query parameters.

### FR-10 Data Management

1. System shall support full CRUD for assignee master data.
2. System shall support full CRUD for officer master data.
3. System shall support data reset (deletes all records, re-seeds defaults).
4. System shall seed default data on first startup.

## 9. API Surface (Implemented)

### Health

- `GET /health` — Returns `{ "ok": true }`

### L/C

- `POST /api/lc` — Create L/C record
- `GET /api/lc` — List L/Cs (supports query params: `status`, `transactionType`, `limit`, `offset`, `preset`, `fromDate`, `toDate`)
- `GET /api/lc/:id` — Get single L/C by ID
- `GET /api/lc/:id/exceptions` — Get exception history for an L/C
- `PATCH /api/lc/:id/status` — Update L/C status (body: `newStatus`, `notes`, `userId`, `exceptionReason`, `exceptionMinutes`, `approvedBy`)

### Master Data

- `GET /api/assignees` — List assignees
- `POST /api/assignees` — Create assignee
- `GET /api/assignees/:id` — Get assignee by ID
- `PUT /api/assignees/:id` — Update assignee
- `DELETE /api/assignees/:id` — Delete assignee
- `GET /api/officers` — List officers
- `POST /api/officers` — Create officer
- `GET /api/officers/:id` — Get officer by ID
- `PUT /api/officers/:id` — Update officer
- `DELETE /api/officers/:id` — Delete officer

### Events

- `GET /api/events` — List events (supports date range query params)
- `GET /api/events/stream` — SSE stream for real-time L/C updates

### SLA and Utility

- `GET /api/sla` — Get current SLA configuration
- `PATCH /api/sla` — Update SLA configuration
- `POST /api/reset` — Reset all data and re-seed defaults

## 10. Frontend Architecture

### 10.1 Pages

| Route | Component | Description |
| --- | --- | --- |
| `/` | ExecDashboardComponent | Executive-level KPIs, analytics, and comparison |
| `/import` | OperationsComponent | Import stream operations dashboard |
| `/export` | OperationsComponent | Export stream operations dashboard |
| `/import/queue` | QueueComponent | Import queue with status actions |
| `/export/queue` | QueueComponent | Export queue with status actions |
| `/import/all` | AllLcsComponent | Import L/C listing |
| `/export/all` | AllLcsComponent | Export L/C listing |
| `/import/create` | CreateOrderComponent | Create Import L/C |
| `/export/create` | CreateOrderComponent | Create Export L/C |
| `/assignee-master` | MasterDataComponent | Assignee CRUD |
| `/officer-registration` | MasterDataComponent | Officer CRUD |
| `/sla` | SlaComponent | SLA configuration |
| `/eventlog` | EventlogComponent | Event log viewer |

### 10.2 Shared Components

- **SidebarComponent**: Navigation, mock role switcher, import/export section grouping.
- **TopbarComponent**: Page title, breadcrumb, clock, language toggle, notification bell, reset button, L/C detail modal (from notifications).

### 10.3 Services

- **DataStoreService**: Central data layer — API calls, signals, localStorage caching, role/scope management, date ranges, SSE subscription.
- **NotificationService**: Computed notifications from L/C data (SLA warnings, new L/Cs, system), read/dismiss state.
- **TranslationService**: i18n toggle (EN/ID) with `TranslatePipe` for templates.

### 10.4 Utilities

- **stage-duration.ts**: Stage duration computation, average calculation, bottleneck detection, formatting helpers.

## 11. Non-Functional Requirements

1. Backend updates shall be transaction-safe under concurrent writes (row-level locking with `SELECT FOR UPDATE`).
2. Stream updates shall not block core API traffic (non-blocking publish, slow subscriber events dropped).
3. Frontend shall degrade gracefully when backend is unavailable via cached local state.
4. UI shall be usable on desktop and mobile form factors (responsive sidebar with hamburger toggle).
5. Date/time parsing shall accept both RFC3339 and YYYY-MM-DD formats.
6. CORS is configured to allow specified origins with mock role headers.

## 12. Constraints and Known Limitations

1. Authentication is mock-based; there is no real identity provider integration.
2. Intake is manual only; there is no live inbox polling/parsing.
3. SLA policy is global; there is no per-stream or per-policy split.
4. Narrative summary is deterministic logic labeled "AI Generated" in UI; no model inference occurs.
5. Notification system is computed client-side from current data; there is no server-side push notification.
6. SSE stream does not carry mock role/scope headers; frontend filters by transaction type after receipt.
7. Exception history is fetched on-demand per L/C (not bulk-loaded).

## 13. Roadmap

### Phase A (Near Term)

1. Implement automated email ingestion and URN policy.
2. Add per-transaction SLA configuration.
3. Add longitudinal trend analytics for throughput and compliance.

### Phase B (Later)

1. Replace mock RBAC with production authentication and server-issued claims.
2. Add backend LLM summarization with explainability and guardrails.
3. Add reporting/export and audit-focused policy controls.
4. Add server-side notification persistence and push capability.

## 14. Acceptance Baseline for Current Release

The current release is considered aligned with this PRD when all conditions below are met:

1. Manual create-to-release workflow works for both Import and Export scopes.
2. Scope and role checks prevent unauthorized actions via both frontend guards and backend middleware.
3. SLA values are configurable and reflected in dashboard classifications.
4. SSE updates trigger frontend data refresh behavior.
5. Event log records create and transition actions with from/to status details.
6. Multiple exceptions per L/C are trackable with individual resolution history.
7. Notifications surface SLA warnings and new L/C alerts with clickable drill-down.
8. Period-over-period SLA comparison panel functions with preset and custom date ranges.
9. Staff and officer performance metrics are computed and displayed.
10. L/C detail modal provides unified timeline, stage duration, stage share, and exception history views across all entry points.