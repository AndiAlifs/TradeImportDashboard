# L/C Processing Time Tracker
# Product Requirements Document

## 1. Executive Summary

The **L/C Processing Time Tracker** is an internal operational tool designed to measure and monitor the lifecycle of Letter of Credit (L/C) documents. It provides visibility into the time spent at each critical stage—from the moment an order email arrives in the inbox to the final release of the L/C. 

The core value proposition is **operational transparency**: a lightweight system that automatically captures the intake, relies on a simple UI for manual stage transitions during the MVP, and provides a clear dashboard to compare actual processing times against parameterized Service Level Agreements (SLAs).

**MVP Goal:** Deliver a functional tracking system utilizing an automated ingestion workflow, a decoupled backend API, a streamlined web frontend for operations staff to log state changes, and a dashboard to identify SLA breaches and workflow bottlenecks.

---

## 2. Mission

**Mission Statement:** Provide real-time visibility into Trade Finance operations, enabling managers to identify bottlenecks and ensuring customer L/C requests are processed well within defined SLAs.

### Core Principles

1. **Automated Intake** — The SLA timer must start the absolute second an email hits the inbox, removing human delay from the initial measurement.
2. **Frictionless Tracking** — For the MVP, manual stage transitions (button clicks) must be instantaneous and require zero data entry.
3. **Decoupled Design** — The tracking logic must remain independent of the core Trade Finance system so that future API pull-integrations can replace the manual MVP buttons without rewriting the architecture.
4. **Data-Driven Insights** — The dashboard should immediately highlight where the process is slowing down.

---

## 3. Target Users

### Primary Personas

**1. The Operations Officer (Processor)**
- **Role:** Handles the drafting, checking, and releasing of the L/C.
- **Goals:** Quickly indicate when they start and finish a stage without slowing down their actual work.
- **Pain Points:** Being blamed for slow processing when the delay might be due to sitting in the inbox or waiting on underlying document checks.

**2. The Operations Manager**
- **Role:** Monitors daily throughput and SLA compliance.
- **Goals:** See average processing times, adjust SLA parameters, and identify which specific stages (Drafting vs. Checking) are causing delays.
- **Pain Points:** Lack of visibility into individual lifecycle stages; only knowing when an L/C started and finished, but not where it got stuck.

---

## 4. MVP Scope

### In Scope

**Core Functionality**
- [x] Automated email inbox monitoring and parsing
- [x] Unique Reference Number (URN) generation upon email receipt
- [x] Master table tracking L/C correlation and receipt timestamp
- [x] Web UI for operations to manually trigger stage transitions (`Start Drafting`, `Start Checking Underlying`, `Release`)
- [x] Parameterized SLA configuration (e.g., default 90-120 minutes)
- [x] Analytics dashboard showing average stage duration and highlighting SLA breaches
- [x] Event log tracking exact user, state, and timestamp

**Technical**
- [x] n8n workflow for email ingestion and API webhook triggering
- [x] C# .NET Core (or Golang) REST API backend
- [x] SQL Server or PostgreSQL database
- [x] Angular frontend for the UI buttons and dashboard

### Out of Scope

**Deferred to Phase 2 (Future)**
- [ ] Direct API pull integration from the core Trade Finance system
- [ ] Integration with future in-house AI PoCs (e.g., L/C Discrepancy Checker acting as an automated system user)
- [ ] Document storage/attachment viewing in the UI
- [ ] Complex user authentication (basic internal role-based access only for MVP)
- [ ] Data export (CSV/Excel)

---

## 5. User Stories

### Primary User Stories

1. **As a system, I want to monitor the incoming order email inbox, so that the SLA timer begins immediately upon receipt.**
   - Example: Email arrives at 08:00 AM; system generates URN `LC-20260311-001` and logs `Status: Received`.

2. **As an operations officer, I want to click a "Start Drafting" button for a specific URN, so that the system records the exact time I began work.**
   - Example: User clicks button; system logs `Status: Drafting` at 08:15 AM.

3. **As an operations officer, I want to click a "Start Checking Underlying" button, so that the drafting phase is marked complete and the checking phase begins.**
   - Example: User finishes the draft and clicks the button; system calculates Drafting took 45 minutes.

4. **As an operations officer, I want to click "Release", so that the overall lifecycle is marked as complete.**
   - Example: User releases the L/C; system stops the overall SLA timer.

5. **As an admin, I want to set the global SLA parameters, so that the dashboard reflects our current operational targets.**
   - Example: Set SLA Min to 90 mins and Max to 120 mins.

6. **As a manager, I want to view a dashboard of all active and completed L/Cs today, so that I can see which ones have breached the 120-minute SLA.**
   - Example: Dashboard flags `LC-20260311-002` in red because it has been in the "Checking Underlying" stage for 95 minutes.

---

## 6. Core Architecture & Patterns

### High-Level Architecture

```text
┌────────────────┐      IMAP / Graph API     ┌─────────────────────┐
│                │ ◄───────────────────────► │                     │
│  Email Server  │                           │    n8n Workflow     │
│ (L/C Inbox)    │                           │    (Ingestion)      │
└────────────────┘                           └──────────┬──────────┘
                                                        │ HTTP POST (Webhook)
                                                        ▼
┌─────────────────────┐      HTTP/JSON       ┌─────────────────────┐
│                     │ ◄──────────────────► │                     │
│ Angular + Tailwind  │                      │ .NET Core / Go API  │
│    (Frontend UI)    │                      │     (Backend)       │
└─────────────────────┘                      └──────────┬──────────┘
                                                        │ EF Core / GORM
                                                        ▼
                                             ┌─────────────────────┐
                                             │                     │
                                             │  SQL Server / PSQL  │
                                             │     (Database)      │
                                             └─────────────────────┘