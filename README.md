# Shila Dashboard - L/C Processing Time Tracker

## Overview

The **L/C Processing Time Tracker (Shila Dashboard)** is an internal operational tool designed to measure and monitor the lifecycle of Letter of Credit (L/C) documents within Trade Finance. It provides real-time visibility into the time spent at each critical stage, from L/C receipt to final release.

The core value proposition is **operational transparency**, enabling managers to identify bottlenecks and ensuring customer L/C requests are processed well within defined Service Level Agreements (SLAs).

## Key Features

1. **Manual Intake Workflow:**
   * Operations users create L/C orders through a UI form and API.
   * Required data includes URN, sender email, subject, transaction type, and received timestamp.
   * Automated email ingestion is a roadmap item and is not currently implemented.
2. **Frictionless Tracking:** Manual stage transitions (`Start Drafting`, `Start Checking Underlying`, `Release`) are instantaneous, requiring zero data entry.
3. **Exception Handling:** Allows operations to mark an L/C with an 'Exception' status and provide a detailed reason, preventing uncontrollable delays from negatively impacting the SLA timer.
4. **Data-Driven Insights:** An analytics dashboard displays active metrics, average stage durations, and immediately highlights SLA breaches.
5. **Flexible SLAs:** Parameterized SLA maximum threshold (e.g., default 120 minutes) to reflect current operational targets.
6. **Detailed Audit Trail:** An event log tracking exact user, state, and timestamps for every transition.
7. **Real-Time Refresh:** Frontend listens to backend SSE updates and refreshes dashboard/queue data.
8. **Accessibility & Usability:**
   * **Multi-language Support:** Toggle between English and Indonesian interfaces.
   * **Mobile-Responsive:** Optimized UI with a hamburger menu for seamless use on mobile devices.

## Architecture

The system utilizes a decoupled design philosophy, separating the tracking logic from the core Trade Finance system for future-proofing and eventual API pull integrations.

* **Frontend UI:** Angular 18 standalone components with custom CSS
* **Backend API:** Go REST API with Gin + GORM
* **Database:** MySQL
* **Realtime:** Server-Sent Events (`GET /api/events/stream`)
* **Mockup folder:** `mockup/` contains historical prototype assets and is not the active app runtime

## Target Audience

* **Operations Officer (Processor):** Handles drafting, checking, and releasing L/Cs. Relies on the tool to quickly log states without interrupting workflow.
* **Operations Manager:** Monitors daily throughput, ensures SLA compliance, and identifies workflow bottlenecks.

## Future Enhancements

* Automated email ingestion and orchestration pipeline.
* Direct API pull integration from the core Trade Finance system.
* Integration with in-house AI PoCs (e.g., Automated L/C Discrepancy Checker).
* Document storage and attachment viewing within the UI.
* Complex role-based user authentication.
* Data export capabilities (CSV/Excel).

## Backend (Go)

The backend in `backend` is active and includes:

- `POST /api/lc`
- `GET /api/lc`
- `GET /api/lc/:id`
- `PATCH /api/lc/:id/status`
- `GET /api/events`
- `GET /api/events/stream`
- `GET /api/sla`
- `PATCH /api/sla`
- `POST /api/reset`

Run locally:

```bash
cd backend
go mod tidy
go run ./cmd/server
```

Code fallback default is `http://localhost:8080` when `APP_PORT` is not set.

Using the provided `.env` defaults, `APP_PORT=8081`, so local backend runtime is typically `http://localhost:8081` unless you override it.

Frontend API base URL defaults to `http://localhost:8081/api` (or `window.SHILA_API_BASE` when provided).

For full as-built product details and roadmap boundaries, see `references/prd.md`.
