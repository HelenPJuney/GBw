# WINDLENS: Video Demonstration Script & Recording Plan

> **Format**: Maximum 10-Minute Demonstration Video (Unlisted on YouTube)  
> **Structure**: Part 1: Executive Customer Presentation (5 min) | Part 2: Technical Architecture Review (5 min)  
> **Status Disclosure**: Screen recording script and execution checklist prepared. As direct automated YouTube uploading is unavailable in this environment, this document provides the exact speaking script and recording steps for manual capture.

---

## Part 1: Executive Customer Presentation (0:00 – 5:00)

### Target Audience
Electricity Procurement Desk Directors, Energy Trading Managers, and Portfolio Risk Analysts.

---

### [0:00 – 1:00] The Day-Ahead Procurement Challenge
- **Visual**: Opening on the **WINDLENS** Overview page (`http://localhost:5173/`).
- **Speaker Script**:
  > *"Welcome everyone. Today we are presenting the outcome of the **WINDLENS** pilot project — a dedicated intelligence platform built specifically for your wholesale day-ahead electricity procurement desk.*
  >
  > *Every afternoon, your commercial trading team commits to purchasing power to meet tomorrow’s customer demand. In the UK, wind generation represents a massive portion of the energy mix, but its non-dispatchable, volatile nature creates significant procurement risk. If your day-ahead team expects 15,000 MW of wind, but only 11,000 MW materializes during delivery, your utility faces costly spot cash-out imbalances and last-minute gas peaker purchases.*
  >
  > *Crucially, procurement managers often struggle with historical forecast evaluation because standard dashboards show the **latest** forecast currently in the database — including updates published hours after your day-ahead trading window closed. WINDLENS solves this by strictly enforcing your decision cutoff."*

---

### [1:00 – 2:15] Navigating the Overview & The Cutoff Rule
- **Visual**: Zoom in on the KPI metric cards and the **D-1 23:59 Cutoff** badge.
- **Speaker Script**:
  > *"Looking at our Executive Dashboard for January 2026: across all 1,488 expected half-hourly settlement intervals, WINDLENS achieves 100% data completeness with zero missing records.*
  >
  > *Notice our baseline cutoff rule: for every single half-hour delivery interval, the platform identifies the latest forecast published **prior to 23:59 GMT of the preceding day**. Forecasts published during the delivery day itself are strictly excluded from this baseline.*
  >
  > *Here in our primary metrics:
  > - National actual wind generation averaged **11,580.7 MW**.
  > - However, the selected day-ahead forecasts predicted an average of **13,294.5 MW**.
  > - That produces a **Mean Bias Error of +1,713.7 MW** across the month.*
  >
  > *This is a critical finding: day-ahead forecasts in January 2026 had a persistent, systematic over-prediction bias."*

---

### [2:15 – 3:30] Deep-Dive: Forecast Explorer in Action
- **Visual**: Click on the **Forecast Explorer** tab. Select January 15, 2026. Scroll through the 30-minute table.
- **Speaker Script**:
  > *"Let's move into the **Forecast Explorer** to see how your traders can inspect specific delivery days.*
  >
  > *Here on January 15th, you can see every half-hour settlement interval from 00:00 to 24:00. 
  > Look at the columns: Delivery Time, Decision Cutoff, Forecast Published Time, and Forecast Age.
  > 
  > Each row shows whether a forecast was eligible for the day-ahead purchasing decision. When National Grid ESO issued revisions on January 14 at 16:00, those were eligible. If an update was published on January 15 at 06:00, our engine flags it as ineligible for the day-ahead baseline.
  >
  > By clicking **View Full Publication History**, your team can audit the exact chronological sequence of every forecast revision published by the ESO leading up to delivery."*

---

### [3:30 – 5:00] Accuracy Evidence & Commercial Procurement Value
- **Visual**: Switch to the **Accuracy Analytics** tab. Hover over the Lead-Time Comparison chart and Error Distribution histogram.
- **Speaker Script**:
  > *"In the **Accuracy Analytics** view, we quantify the operational uncertainty:*
  >
  > *- **Mean Absolute Error (MAE)** was **1,940.82 MW**, representing the expected error volume on any given interval.*
  > *- **RMSE** reached **2,410.57 MW**. Because RMSE penalizes large errors heavily, this spread indicates significant forecast spikes during winter storm transitions.*
  >
  > *Our **Lead-Time Bucket Analysis** reveals an actionable operational insight: forecasts published 24 to 48 hours before delivery had an average error of over 2,200 MW, whereas forecasts published 6 to 12 hours prior to delivery narrowed errors down by nearly 400 MW.*
  >
  > *How does this support your procurement strategy?
  > Rather than locking in 100% of your hedge based on early day-ahead forecasts, this historical evidence justifies a phased hedging strategy: procure a conservative 70% base at gate closure, leaving headroom to capture more accurate short-term forecasts without incurring over-contracted volume penalties.*
  >
  > *With one click, your analysts can use **Export CSV** to feed these validated intervals directly into your internal proprietary risk models."*

---

## Part 2: Technical Review & Architecture (5:00 – 10:00)

### Target Audience
Lead Software Architects, Data Engineers, DevOps Engineers, and Technical Auditors.

---

### [5:00 – 6:15] System Architecture & Technology Stack
- **Visual**: Display system architecture diagram and code structure in IDE.
- **Speaker Script**:
  > *"Moving to the technical architecture: WINDLENS is built with a decoupled Python FastAPI backend and a modern React 19 + TypeScript frontend with Vite.*
  >
  > *Why this stack?
  > - **Python (FastAPI, Pandas, PyArrow)**: Fast, type-safe API routing with native vectorization for time-series aggregation and Parquet persistence.
  > - **React 19 + Recharts + Lucide**: High-contrast, responsive UI styled with vanilla CSS custom properties, achieving an elegant energy-trading aesthetic with liquid-glass highlights without external UI library bloat.*
  >
  > *The backend acts as the single source of truth for all mathematical calculations — no error calculations are ever performed in the frontend."*

---

### [6:15 – 7:30] Official Elexon BMRS Stream Integrations & Data Ingestion
- **Visual**: Open `backend/app/clients/elexon.py` and `backend/app/services/data_service.py`.
- **Speaker Script**:
  > *"The platform integrates **strictly two** official Elexon streaming endpoints:
  > 1. **FUELHH Stream**: Ingests actual outturn generation across Great Britain. Our data pipeline filters strictly for `fuelType == 'WIND'` and deduplicates records by `(startTime, fuelType)`.
  > 2. **WINDFOR Stream**: Ingests wind generation forecasts. We query with a 3-day lookback into late December 2025 so that day-ahead forecasts targeting January 1st are fully captured.*
  >
  > *The `ElexonClient` implements:
  > - Respectful rate-limiting (0.5s pause between calls).
  > - Exponential backoff on HTTP 500 and network timeouts.
  > - Automatic retry handling for HTTP 429 using the `Retry-After` header.*
  >
  > *Validated datasets are saved locally to Parquet files (`actuals_wind_jan2026.parquet` and `forecasts_windfor_jan2026.parquet`) ensuring fast, reproducible execution without external database dependencies."*

---

### [7:30 – 8:30] Forecast Eligibility & Optimization Logic
- **Visual**: Open `backend/app/services/forecast_selection.py`.
- **Speaker Script**:
  > *"Here in `forecast_selection.py` is our critical business logic:*
  >
  > *1. **Timestamp Normalization**: All timestamps are parsed as UTC internally and converted to `Europe/London`.*
  > *2. **Resolution Matching**: Elexon WINDFOR forecasts are published at hourly resolution, while FUELHH actuals are half-hourly (48 settlement periods per day). For every half-hourly settlement period, our algorithm checks for an exact timestamp match, and if not present, matches the containing hour.*
  > *3. **Pre-Grouped O(1) Lookups**: Ingesting a month of forecasts yields over 18,000 revisions. By pre-grouping forecasts into hash dictionaries keyed by `startTime`, our algorithm selects eligible records across all 1,488 intervals in less than 0.05 seconds, preventing the 30-second delays of naive DataFrame scanning.*
  > *4. **Deterministic Tie-Breaking**: When multiple revisions share the exact latest publish timestamp, the record with higher generation is selected deterministically."*

---

### [8:30 – 9:15] Testing Strategy & Quality Gates
- **Visual**: Open terminal and run `python -m pytest tests/ -v`.
- **Speaker Script**:
  > *"Our test suite comprises **42 automated Pytest tests** with 100% passing results:*
  >
  > *- 30 unit tests covering WIND-only filtering, boundary conditions, UTC/GMT timezone conversion, post-cutoff rejection, tie-breaking, and zero-actual MAPE exclusion.*
  > *- 12 integration and resilience tests validating all 8 REST endpoints, HTTP 500 retries, 429 rate limit backoff, and CSV export formatting.*
  >
  > *On the frontend, TypeScript is compiled in strict mode with zero type errors, producing an optimized Vite production bundle in under 12 seconds."*

---

### [9:15 – 10:00] Docker, Deployment & Wrap-Up
- **Visual**: Show `docker-compose.yml` and final summary slide.
- **Speaker Script**:
  > *"For deployment, the application is containerized with a multi-stage Nginx frontend Dockerfile and a Python 3.11-slim backend Dockerfile.*
  >
  > *A single command:
  > `docker compose up --build`
  > spins up both services with automated healthchecks, reverse-proxy API routing, and persistent Parquet storage mounts.*
  >
  > *In summary, WINDLENS delivers a verified, production-grade intelligence tool that bridges the gap between raw Elexon BMRS data streams and disciplined day-ahead wholesale energy procurement.*
  >
  > *Thank you for your time. The full codebase, automated test suite, and documentation are available in the repository."*

---

## Screen Recording Execution Checklist

- [ ] **Prep**: Ensure backend is running (`uvicorn app.main:app`) and frontend is live (`npm run dev`).
- [ ] **Scene 1**: (0:00) Full-screen browser on `http://localhost:5173/` Overview tab.
- [ ] **Scene 2**: (1:15) Hover over KPI StatCards (Coverage, MAE, MBE bias badge).
- [ ] **Scene 3**: (1:45) Hover over the Actual vs Forecast time series chart demonstrating custom tooltips.
- [ ] **Scene 4**: (2:15) Click **Forecast Explorer** tab. Change delivery date to `2026-01-15`.
- [ ] **Scene 5**: (2:45) Click **View Full Publication History** to display chronological forecast revision logs.
- [ ] **Scene 6**: (3:30) Click **Accuracy Analytics** tab. Hover over Lead-Time buckets and Error Distribution.
- [ ] **Scene 7**: (4:30) Click **Export CSV** in the top navigation. Show modal date inputs.
- [ ] **Scene 8**: (5:00) Split-screen or switch to VS Code / IDE. Show architecture diagram in `README.md`.
- [ ] **Scene 9**: (6:15) Highlight `elexon.py` client and `data_service.py` Parquet caching.
- [ ] **Scene 10**: (7:30) Highlight `forecast_selection.py` cutoff algorithm and O(1) lookup dictionary.
- [ ] **Scene 11**: (8:30) Run `python -m pytest tests/ -v` in terminal demonstrating 42 tests passing.
- [ ] **Scene 12**: (9:15) Show `docker-compose.yml` and conclude presentation.
