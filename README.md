# Shila Dashboard - L/C Processing Time Tracker

## Overview

The **L/C Processing Time Tracker (Shila Dashboard)** is an internal operational tool designed to measure and monitor the lifecycle of Letter of Credit (L/C) documents within Trade Finance. It provides real-time visibility into the time spent at each critical stage—from the moment an order email arrives in the inbox to the final release of the L/C. 

The core value proposition is **operational transparency**, enabling managers to identify bottlenecks and ensuring customer L/C requests are processed well within defined Service Level Agreements (SLAs).

## Key Features

1. **Automated & Manual Intake:** 
   * **Automated:** The SLA timer starts the absolute second an email hits the inbox, generating a Unique Reference Number (URN) and logging the receipt timestamp.
   * **Manual Form:** Operations officers can manually create a new L/C order through a UI form to process requests outside the automated email workflow.
2. **Frictionless Tracking:** Manual stage transitions (`Start Drafting`, `Start Checking Underlying`, `Release`) are instantaneous, requiring zero data entry.
3. **Exception Handling:** Allows operations to mark an L/C with an 'Exception' status and provide a detailed reason, preventing uncontrollable delays from negatively impacting the SLA timer.
4. **Data-Driven Insights:** An analytics dashboard displays active metrics, average stage durations, and immediately highlights SLA breaches.
5. **Flexible SLAs:** Parameterized SLA configuration (e.g., default 90-120 minutes) to reflect current operational targets.
6. **Detailed Audit Trail:** An event log tracking exact user, state, and timestamps for every transition.
7. **Accessibility & Usability:**
   * **Multi-language Support:** Toggle between English and Indonesian interfaces.
   * **Mobile-Responsive:** Optimized UI with a hamburger menu for seamless use on mobile devices.

## Architecture

The system utilizes a decoupled design philosophy, separating the tracking logic from the core Trade Finance system for future-proofing and eventual API pull integrations.

* **Frontend UI:** Angular + Tailwind (Currently mocked as HTML/JS/CSS for MVP)
* **Ingestion:** n8n Workflow reading from IMAP / Graph API Email Server
* **Backend API:** C# .NET Core (or Golang) REST API
* **Database:** SQL Server or PostgreSQL (via EF Core / GORM)

## Target Audience

* **Operations Officer (Processor):** Handles drafting, checking, and releasing L/Cs. Relies on the tool to quickly log states without interrupting workflow.
* **Operations Manager:** Monitors daily throughput, ensures SLA compliance, and identifies workflow bottlenecks.

## Future Enhancements (Phase 2)

* Direct API pull integration from the core Trade Finance system.
* Integration with in-house AI PoCs (e.g., Automated L/C Discrepancy Checker).
* Document storage and attachment viewing within the UI.
* Complex role-based user authentication.
* Data export capabilities (CSV/Excel).

## Backend Starter (Go)

A backend starter is available in the `backend` folder with Core CRUD endpoints:

- `POST /api/lc`
- `GET /api/lc`
- `GET /api/lc/:id`
- `PATCH /api/lc/:id/status`
- `GET /api/events`
- `GET /api/sla`
- `PATCH /api/sla`

Run locally:

```bash
cd backend
go mod tidy
go run ./cmd/server
```

By default the server runs on `http://localhost:8080`.
