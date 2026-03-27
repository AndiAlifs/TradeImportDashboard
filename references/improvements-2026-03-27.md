# Improvement Pending (27/3)

This document expands each pending item into clear implementation guidance for backend, frontend, data impact, and validation.

## Item 1 - Fix exception description disappearing in L/C timeline after release

### Problem statement
When an L/C enters Exception and is then released back to normal flow, the exception entry in the detail timeline can disappear. This causes loss of visibility for exception reason and exception history.

### Expected behavior
Exception history must remain visible in L/C detail timeline even after status changes from Exception to another stage.

### Scope
- All L/C detail modals:
  - All LCs view
  - Queue view
  - Operations view

### Implementation plan
1. Backend:
	- Ensure exception lifecycle data is persisted and returned in API response after release:
	  - exceptionReason
	  - exceptionStartedAt
	  - exceptionResolvedAt
	  - exceptionTotalMinutes
	- Verify transition logic from Exception to next status accumulates and stores duration correctly.
2. Frontend:
	- Update timeline rendering logic to use persisted exception fields, not only current status.
	- Render exception timeline block when historical exception fields exist, even if current status is not Exception.
3. Data behavior:
	- Keep existing records compatible.
	- No data deletion on release.

### Acceptance criteria
- Exception timeline remains visible after release.
- Exception reason remains visible after release.
- Exception total duration remains visible after release.
- Works consistently in All LCs, Queue, and Operations detail modals.

### Validation checklist
- Create L/C.
- Move to Exception with reason.
- Release from Exception.
- Open detail modal in all target views and confirm exception timeline data still exists.

## Item 2 - Remove sender email

### Problem statement
Sender email is no longer needed and should be removed from the system.

### Expected behavior
Sender email should not appear in UI, API contract, or persisted model for new behavior.

### Scope
- Frontend forms and displays
- Backend request/response structs
- Backend model fields

### Implementation plan
1. Frontend:
	- Remove sender email input from create order form.
	- Remove sender email columns and labels from related list and detail screens.
2. Backend:
	- Remove senderEmail from create request payload binding.
	- Remove senderEmail from response DTO if exposed.
	- Remove sender email field from model mapping for new writes.
3. Database/migration consideration:
	- Decide whether to keep legacy column for backward compatibility or drop it in migration.
	- If dropped, add migration note and rollout order.

### Acceptance criteria
- No sender email field is displayed in frontend.
- Backend no longer requires sender email on create.
- API and model behavior remain stable for the rest of L/C creation flow.

### Validation checklist
- Create new L/C without sender email.
- Confirm no UI area displays sender email.
- Confirm backend accepts request and stores record successfully.

## Item 3 - Show exception start time, end time, and duration in L/C detail

### Problem statement
Exception detail currently lacks complete time information in L/C detail modal.

### Expected behavior
L/C detail modal must show:
- Exception start time
- Exception end time
- Total exception duration

### Scope
- Detail modal in All LCs, Queue, Operations
- Timeline/detail section for exception information

### Implementation plan
1. Backend:
	- Ensure API includes exceptionStartedAt, exceptionResolvedAt, and exceptionTotalMinutes for every L/C with exception history.
2. Frontend:
	- Add fields in L/C detail modal:
	  - Start: formatted local datetime
	  - End: formatted local datetime (or Active when not resolved)
	  - Duration: human-readable (for example 2h 15m)
	- Ensure values are shown both during active exception and after release.
3. Translations:
	- Add or update label keys for Start Time, End Time, and Exception Duration.

### Acceptance criteria
- Detail modal shows start, end, and duration for exception.
- Active exception shows ongoing duration updates or clear active state.
- Resolved exception shows fixed final duration.

### Validation checklist
- Trigger active exception and check start time and live duration.
- Resolve exception and check end time and final duration.
- Verify labels in supported language settings.

## Item 4 - Dashboard field changes (sender to subject, assignee analyst name, releaser officer name)

### Problem statement
Dashboard labeling and displayed fields do not reflect required business language and ownership visibility.

### Expected behavior
- Replace sender with subject in relevant dashboard displays.
- Show assignee analyst name.
- Show releaser officer name.

### Scope
- Executive dashboard
- Import/Export dashboards or related summary widgets/tables

### Implementation plan
1. Frontend display updates:
	- Replace sender column/label with subject.
	- Add assignee name field display (analyst assignment owner).
	- Add officer releaser name display.
2. Data readiness:
	- Confirm frontend store receives assignee and officer identity fields from API.
	- If missing, add backend response fields and mapping.
3. Labels/translations:
	- Standardize naming across dashboards:
	  - Subject
	  - Analyst Assignee
	  - Releaser Officer

### Acceptance criteria
- Dashboard no longer shows sender; subject is shown instead.
- Assignee analyst name is visible where ownership is needed.
- Releaser officer name is visible where release ownership is needed.
- Label naming is consistent in all target dashboard screens.

### Validation checklist
- Open executive and import/export dashboards.
- Confirm subject appears in place of sender.
- Confirm assignee and releaser names render for records with assignments/releases.

## Item 5 - SLA counting with exception time and breached with exception status

### Problem statement
SLA evaluation must consider exception time. When SLA is exceeded with exception-adjusted logic, status should explicitly indicate breach context.

### Expected behavior
- SLA should be calculated using effective processing time:
  - effectiveMinutes = totalElapsedMinutes - exceptionTotalMinutes
- If effectiveMinutes exceeds SLA threshold, status should be Breached with Exception.

### Scope
- SLA status logic
- Dashboard/list badges and labels
- Any KPI card or summary counting SLA status

### Implementation plan
1. Business rule standardization:
	- Define one shared rule for all screens:
	  - totalElapsedMinutes derived from receivedAt to now/closedAt
	  - exceptionTotalMinutes derived from accumulated exception duration
	  - breach check based on effectiveMinutes
2. Backend or frontend calculation alignment:
	- If SLA status is computed on backend, add status variant Breached with Exception.
	- If computed on frontend, add mapping logic for this status in all relevant components.
3. UI status updates:
	- Add badge/label style for Breached with Exception.
	- Ensure counts and filters include this status appropriately.
4. Translations:
	- Add translation key for Breached with Exception.

### Acceptance criteria
- SLA breach decision uses effectiveMinutes (after exception deduction).
- Records exceeding SLA under this rule show Breached with Exception.
- Status is consistent across lists, dashboards, and detail sections.

### Validation checklist
- Test case A: high total time but high exception time, effectiveMinutes under SLA -> not breached.
- Test case B: effectiveMinutes above SLA -> Breached with Exception.
- Confirm badge, label, and counts match expected rule.

## Delivery notes
- Priority order recommendation:
  1. Item 1 and Item 3 (exception visibility correctness)
  2. Item 5 (SLA business rule correctness)
  3. Item 4 (dashboard language and ownership visibility)
  4. Item 2 (sender email removal)
- Suggested rollout:
  - Release backend and frontend changes together for field compatibility.
  - Include targeted regression test scenarios for exception and SLA behavior.
