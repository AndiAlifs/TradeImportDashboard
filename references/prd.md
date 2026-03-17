# L/C Processing Time Tracker
# Product Requirements Document

## 1. Executive Summary

The **L/C Processing Time Tracker** is an internal operational tool designed to measure and monitor the lifecycle of Letter of Credit (L/C) documents for both **Import** and **Export** trade finance operations. It provides visibility into the time spent at each critical stage—from the moment an order email arrives in the inbox to the final release of the L/C—with **dedicated views** for Import and Export workflows.

The core value proposition is **operational transparency**: a lightweight system that automatically captures the intake, relies on a simple UI for manual stage transitions during the MVP, and provides clear, role-based dashboards to compare actual processing times against parameterized Service Level Agreements (SLAs). An **Executive Dashboard** offers senior management a unified overview of both Import and Export performance, complemented by **AI-generated summaries** that highlight trends, anomalies, and actionable insights.

**MVP Goal:** Deliver a functional tracking system utilizing an automated ingestion workflow, a decoupled backend API, a streamlined web frontend for operations staff to log state changes, differentiated Import/Export views, an executive-level dashboard, and AI-powered performance summaries to identify SLA breaches and workflow bottlenecks.

---

## 2. Mission

**Mission Statement:** Provide real-time visibility into **Import and Export** Trade Finance operations, enabling managers and executives to identify bottlenecks, compare cross-functional performance, and ensure customer L/C requests are processed well within defined SLAs—supported by AI-driven insights for strategic decision-making.

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
- **Role:** Monitors daily throughput and SLA compliance for their respective area (Import or Export).
- **Goals:** See average processing times, adjust SLA parameters, and identify which specific stages (Drafting vs. Checking) are causing delays within their operational stream.
- **Pain Points:** Lack of visibility into individual lifecycle stages; only knowing when an L/C started and finished, but not where it got stuck.

**3. The Executive / Senior Manager**
- **Role:** Oversees the entire Trade Finance function, covering both Import and Export operations.
- **Goals:** Gain a holistic view of operational performance across both Import and Export, quickly understand key trends, SLA breach rates, and throughput via an AI-generated executive summary.
- **Pain Points:** Information is siloed between Import and Export teams; requires manual consolidation of reports to assess overall health; no concise, at-a-glance narrative of operational status.

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
- [x] Status exceptions to pause the SLA timer and log exception reasons
- [x] Manual order creation via UI form
- [x] Multi-language support (English/Indonesian toggle)
- [x] Mobile-responsive UI with hamburger menu toggle

**Import / Export Differentiation**
- [ ] Transaction type field (`Import` or `Export`) on every L/C record
- [ ] Dedicated **Import View** — filtered queue and analytics showing only Import L/Cs
- [ ] Dedicated **Export View** — filtered queue and analytics showing only Export L/Cs
- [ ] Ability to tag transaction type during manual order creation and automated ingestion (parsed from email subject/body or configurable rule)
- [ ] Separate SLA parameters configurable per transaction type (Import vs. Export may have different SLA targets)

**Executive Dashboard**
- [ ] Unified **Dashboard View** accessible to executives / senior managers
- [ ] Side-by-side or tabbed comparison of Import vs. Export performance metrics (throughput, average processing time, SLA breach rate)
- [ ] Key Performance Indicators (KPIs): total processed today, SLA compliance %, average cycle time, breach count — broken down by Import and Export
- [ ] Trend charts (daily/weekly) for processing volume and SLA compliance across both streams
- [ ] **AI-Powered Summary** — an auto-generated natural-language narrative summarizing:
  - Overall operational health for the selected period
  - Notable SLA breaches and their root stages
  - Comparative performance between Import and Export
  - Anomaly detection (e.g., unusual spike in processing time)
  - Actionable recommendations (e.g., "Export Drafting stage averaged 20% longer than last week — consider reviewing staffing")

**Technical**
- [x] n8n workflow for email ingestion and API webhook triggering
- [x] C# .NET Core (or Golang) REST API backend
- [x] SQL Server or PostgreSQL database
- [x] Angular frontend for the UI buttons and dashboard
- [ ] LLM integration service for AI summary generation (e.g., Google Gemini API or OpenAI API via backend proxy)

### Out of Scope

**Deferred to Phase 2 (Future)**
- [ ] Direct API pull integration from the core Trade Finance system
- [ ] Integration with future in-house AI PoCs (e.g., L/C Discrepancy Checker acting as an automated system user)
- [ ] Document storage/attachment viewing in the UI
- [ ] Complex user authentication (basic internal role-based access only for MVP)
- [ ] Data export (CSV/Excel)
- [ ] Granular role-based dashboard permissions (e.g., restricting Import view to Import team only)
- [ ] AI-driven predictive SLA breach alerts (real-time push notifications)

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

7. **As an operations officer, I want to mark an L/C with an 'Exception' status and provide a detailed reason, so that uncontrollable delays do not negatively impact the SLA timer.**
   - Example: Waiting for underlying checking documents, pausing the SLA clock.

8. **As an operations officer, I want to manually create a new L/C order through a form in the UI, so that I can process requests that circumvent the automated email ingestion system.**
   - Example: Filling out sender, subject, and assignee on the "Create Order" page.

9. **As a user, I want to toggle between English and Indonesian languages, so that I can interact with the system in my preferred language.**
   - Example: Clicking the "EN/ID" button translates all core UI text dynamically.

10. **As a user on a mobile device, I want to use a hamburger menu to access the navigation, so that the screen real estate is optimized for my display.**
     - Example: Viewing the dashboard on a phone, clicking the menu icon to switch to the Queue view.

### Import / Export Differentiation Stories

11. **As an operations officer, I want each L/C to be tagged as either Import or Export, so that the data is properly categorized from the moment of intake.**
    - Example: An email with subject containing "Import L/C" is automatically tagged as `Import`; an officer manually creating an order selects `Export` from a dropdown.

12. **As an import operations officer, I want to access a dedicated Import View showing only Import L/Cs, so that I can focus on my relevant workload without noise from Export transactions.**
    - Example: Navigating to the "Import" section shows a filtered queue and analytics dashboard scoped to Import L/Cs only.

13. **As an export operations officer, I want to access a dedicated Export View showing only Export L/Cs, so that I can manage export workflows independently.**
    - Example: Navigating to the "Export" section shows a filtered queue and analytics dashboard scoped to Export L/Cs only.

14. **As an admin, I want to configure separate SLA parameters for Import and Export transactions, so that each stream is measured against its own operational targets.**
    - Example: Import SLA is set to 90–120 minutes; Export SLA is set to 60–90 minutes.

### Executive Dashboard Stories

15. **As an executive, I want to view a unified Dashboard that shows both Import and Export performance side by side, so that I can assess overall Trade Finance operational health at a glance.**
    - Example: Dashboard displays two KPI cards—Import shows 95% SLA compliance, Export shows 88% SLA compliance—with trend sparklines.

16. **As an executive, I want to see an AI-generated summary of today's (or this week's) performance, so that I can quickly understand key trends and issues without reading through individual records.**
    - Example: The AI summary reads: *"Today's Import processing averaged 82 minutes (within SLA). Export had 3 SLA breaches—all stuck at the Checking Underlying stage. Recommendation: Review Export checking workload distribution."*

17. **As an executive, I want the AI summary to highlight anomalies and provide actionable recommendations, so that I can make informed decisions about resource allocation and process improvements.**
    - Example: AI flags: *"Export volume spiked 40% compared to last week's average. Consider temporary staffing reallocation from Import (which is trending 15% below average volume)."*

---

## 6. Core Architecture & Patterns

### High-Level Architecture

```text
┌────────────────┐      IMAP / Graph API     ┌─────────────────────┐
│                │ ◄───────────────────────► │                     │
│  Email Server  │                           │    n8n Workflow     │
│ (L/C Inbox)    │                           │  (Ingestion + Tag)  │
└────────────────┘                           └──────────┬──────────┘
                                                        │ HTTP POST (Webhook)
                                                        │ + Import/Export tag
                                                        ▼
┌─────────────────────┐      HTTP/JSON       ┌─────────────────────┐
│                     │ ◄──────────────────► │                     │
│ Angular + Tailwind  │                      │ .NET Core / Go API  │
│    (Frontend UI)    │                      │     (Backend)       │
│                     │                      │                     │
│ ┌─────────────────┐ │                      └──────────┬──────────┘
│ │  Import View    │ │                                 │ EF Core / GORM
│ │  Export View    │ │                                 ▼
│ │  Exec Dashboard │ │                      ┌─────────────────────┐
│ └─────────────────┘ │                      │                     │
└─────────────────────┘                      │  SQL Server / PSQL  │
                                             │     (Database)      │
       ┌──────────────────┐                  └─────────────────────┘
       │   LLM Service    │
       │ (AI Summary Gen) │◄──── Backend calls LLM API to generate
       │ Gemini / OpenAI  │      executive summary on demand
       └──────────────────┘
```

### View Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     Navigation Bar                      │
├──────────┬──────────┬──────────────┬────────────────────┤
│  Import  │  Export  │  Dashboard   │  Settings / Admin  │
│  View    │  View    │  (Executive) │                    │
├──────────┴──────────┴──────────────┴────────────────────┤
│                                                         │
│  Import View:     Filtered queue + analytics (Import)   │
│  Export View:     Filtered queue + analytics (Export)    │
│  Dashboard View:  Combined KPIs + Trends + AI Summary   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```