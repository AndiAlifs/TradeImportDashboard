# L/C Processing Time Tracker
# Product Requirements Document

## 1. Executive Summary

The L/C Processing Time Tracker is an internal tool for monitoring the lifecycle of Import and Export Letter of Credit records, with clear visibility into stage timing, SLA performance, and operational bottlenecks.

This document is updated to match the current repository implementation across frontend and backend. The system today is a manual intake and manual transition workflow with role-scoped access, real-time update streaming, and rule-based executive narrative insights. Automated email ingestion and backend LLM summary generation remain target-state items.

## 2. Current Product Mission

Provide operational transparency for Trade Finance processing by:

1. Capturing end-to-end lifecycle timestamps per L/C record.
2. Enabling quick status transitions for operations users.
3. Tracking SLA compliance and breach risk in Import and Export streams.
4. Providing management and executive visibility into throughput, delays, and bottleneck stages.

## 3. Target Users and Access Model

### Personas

1. Operations Staff/Officer (Import or Export scope): creates and processes L/Cs in assigned stream.
2. Executive: consumes dashboards, event logs, and configuration views.
3. Super Admin: full access across all views, configuration, and reset actions.

### Implemented Role Model (Mock RBAC)

Frontend role selector and backend request headers simulate role-based access using:

- Roles: super_admin, executive, import_officer, import_staff, export_officer, export_staff.
- Scope: All, Import, Export.
- Headers: X-Mock-Role, X-Mock-Scope, X-Mock-User.

## 4. Scope and Status (As Built)

### Implemented

#### Core Workflow

- Manual L/C creation with required fields: URN, sender email, subject, transaction type, assignee.
- Lifecycle statuses: Received, Drafting, Checking Underlying, Released, Breached, Exception.
- Status transition controls in queue view:
  - Start Drafting
  - Start Checking Underlying
  - Release (officer-level restriction)
  - Mark Exception
  - Resolve Exception (with exception minutes adjustment)
- Event log entries created for create and status transitions.
- Approved-by officer support on release.

#### SLA and Timing

- Global SLA configuration (single min/max pair, default 90/120 minutes).
- SLA indicators for in-progress and released records.
- Exception minutes deducted from elapsed SLA calculation.
- Breach detection in operational and executive dashboards.

#### Import/Export Differentiation

- Transaction type stored per L/C.
- Separate import/export routes and views:
  - dashboard
  - all L/Cs list
  - queue
  - create order
- Scope-aware filtering enforced in backend for non-All roles.

#### Dashboards and Insights

- Import/Export operations dashboards with KPI cards:
  - active
  - completed
  - breaches
  - average time
- Executive dashboard with combined Import vs Export KPIs.
- Stage comparison bars across streams.
- Bottleneck focus panel using stage-duration calculations.
- Narrative summary card labeled AI Generated, but generated with deterministic frontend rules (no model call).

#### Real-Time Updates

- Server-sent events endpoint for LC updates.
- Frontend subscribes and triggers silent refresh on relevant updates.

#### Platform and UX

- Angular standalone-component frontend.
- Go (Gin + GORM) backend with MySQL.
- English/Indonesian language toggle.
- Responsive layout with sidebar toggle/hamburger behavior.

### Not Yet Implemented (Target State)

- Automated email inbox ingestion/parsing.
- n8n or equivalent ingestion orchestration.
- Backend LLM integration for true AI summaries.
- Separate SLA configuration by transaction type.
- Trend charts for daily/weekly longitudinal analysis.

## 5. Functional Requirements

### FR-1 L/C Record Management

1. System shall allow manual creation of an L/C record with required metadata.
2. URN shall be unique.
3. System shall store timestamps for lifecycle milestones.

### FR-2 Status Lifecycle Control

1. System shall enforce valid transition paths between statuses.
2. System shall record an event log entry for each transition.
3. Release action shall be restricted to officer roles (or super admin).

### FR-3 Exception Handling

1. User shall be able to set status to Exception with optional reason.
2. User shall be able to resolve exception and provide effective exception minutes.
3. Exception time shall reduce SLA elapsed time in dashboard calculations.

### FR-4 SLA Management

1. System shall support configurable global SLA min/max values.
2. System shall classify records as OK, warning, or breach using configured thresholds.
3. SLA configuration updates shall be access controlled.

### FR-5 Role and Scope Authorization

1. System shall gate routes and API actions by role.
2. Import-scoped users shall be blocked from Export records and actions, and vice versa.
3. Executive shall have read-heavy access to overview, logs, and SLA/admin views per current policy.

### FR-6 Executive Visibility

1. System shall present combined Import/Export KPI performance.
2. System shall present stage-duration comparison and bottleneck indicators.
3. System shall present a summary narrative of current performance (rule-based in current build).

### FR-7 Real-Time Refresh

1. Backend shall publish LC update events for subscribers.
2. Frontend shall refresh data when subscribed update events are received.

## 6. API Surface (Current)

### Health

- GET /health

### L/C

- POST /api/lc
- GET /api/lc
- GET /api/lc/:id
- PATCH /api/lc/:id/status

### Events

- GET /api/events
- GET /api/events/stream

### Master Data

- GET /api/assignees
- POST /api/assignees
- GET /api/assignees/:id
- PUT /api/assignees/:id
- DELETE /api/assignees/:id
- GET /api/officers
- POST /api/officers
- GET /api/officers/:id
- PUT /api/officers/:id
- DELETE /api/officers/:id

### SLA and Utility

- GET /api/sla
- PATCH /api/sla
- POST /api/reset

## 7. Non-Functional Requirements

1. Backend must support concurrent status updates safely (transaction + row locking).
2. Frontend should remain usable when backend is unavailable by using cached local state.
3. Real-time stream must not block normal API operations.
4. UI should be usable on desktop and mobile form factors.

## 8. Gap-to-Target Roadmap

### Phase A (Next)

1. Introduce automated email intake pipeline and URN auto-generation policy.
2. Add per-transaction SLA profiles.
3. Add trend charts for volume/compliance over time.

### Phase B

1. Replace mock RBAC with real authentication and server-issued identity claims.
2. Integrate backend LLM summarization with explainable prompts and guardrails.
3. Add export/reporting and audit-focused access policies.

## 9. Assumptions and Notes

1. This PRD reflects repository behavior as of 2026-03-26.
2. Current "AI summary" is a rule-based frontend narrative, not an external LLM output.
3. Current SLA configuration is global, not Import/Export-specific.
4. Automated inbox monitoring is not present in this codebase.