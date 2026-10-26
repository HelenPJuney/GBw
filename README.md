# WINDLENS: UK Wind Forecast Intelligence Portal

> **Production MVP for UK Electricity Wholesale Day-Ahead Procurement Decision Support**  
> *Authoritative analysis of wind generation actuals and forecasts from official Elexon BMRS streams.*

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Elexon BMRS](https://img.shields.io/badge/Data-Elexon_BMRS-FF6F00)](https://bmrs.elexon.co.uk/)

---

## Quick Navigation
1. [What You Need to Download (Prerequisites)](#1-what-you-need-to-download-prerequisites)
2. [Quickest Way to Run (Windows 1-Click Launcher)](#2-quickest-way-to-run-windows-1-click-launcher)
3. [Manual Step-by-Step Setup (Windows / macOS / Linux)](#3-manual-step-by-step-setup-windows--macos--linux)
4. [Running with Docker (Alternative)](#4-running-with-docker-alternative)
5. [Application URLs & Access Points](#5-application-urls--access-points)
6. [Running the Automated Test Suite](#6-running-the-automated-test-suite)
7. [What Does WINDLENS Do? (Business Context)](#7-what-does-windlens-do-business-context)
8. [System Architecture & Data Flow](#8-system-architecture--data-flow)
9. [Project Directory Structure](#9-project-directory-structure)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. What You Need to Download (Prerequisites)

Before running the application, make sure your computer has the following tools installed:

### 1. Python (Version 3.11 or higher)
- **Download Link**: [python.org/downloads](https://www.python.org/downloads/)
- **Important Windows Installation Tip**: During the installation wizard, **check the box** that says **"Add python.exe to PATH"** before clicking Install. If this is not checked, the system will not recognize the `python` command in the terminal.
- **Verify installation**:
  ```bash
  python --version
  ```
  *(Should output `Python 3.11.x` or higher)*

### 2. Node.js (Version 18.x, 20.x, or 22.x LTS)
- **Download Link**: [nodejs.org](https://nodejs.org/) (Choose the **LTS** version).
- Node.js includes `npm` (Node Package Manager) needed to run the frontend.
- **Verify installation**:
  ```bash
  node -v
  npm -v
  ```

### 3. Git (Optional, if cloning the repository)
- **Download Link**: [git-scm.com/downloads](https://git-scm.com/downloads)

---

## 2. Quickest Way to Run (Windows 1-Click Launcher)

If you are on Windows, automated batch scripts are provided in the root directory so you don't have to open multiple terminals manually:

### To Start the Application:
1. Double-click **`start.bat`** in the project root folder.
2. The script will automatically:
   - Create your `.env` configuration files from `.env.example`.
   - Launch the **FastAPI Backend** on port `8000`.
   - Launch the **React Vite Frontend** on port `5173`.
   - Automatically open your default web browser to **`http://localhost:5173`**.

### To Stop the Application:
- Double-click **`stop.bat`** or simply close the command prompt windows.

---

## 3. Manual Step-by-Step Setup (Windows / macOS / Linux)

If you prefer to start the servers manually or are working on macOS/Linux, follow these simple steps:

### Step 1: Clone or Open the Project Folder
```bash
cd Wind
```

### Step 2: Set Up Environment Files
Copy the example environment file in both the root and backend folders:
- **On Windows (Command Prompt)**:
  ```cmd
  copy .env.example .env
  copy .env.example backend\.env
  ```
- **On macOS / Linux**:
  ```bash
  cp .env.example .env
  cp .env.example backend/.env
  ```

---

### Step 3: Run the Backend (FastAPI)

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. *(Recommended)* Create and activate a Python virtual environment:
   - **Windows**:
     ```cmd
     python -m venv venv
     venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend development server:
   ```bash
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

You will see:
```text
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     WINDLENS API starting up
```

---

### Step 4: Run the Frontend (React + Vite)

1. Open a **second terminal** and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install the frontend dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

You will see:
```text
  VITE v6.x.x  ready in 250 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

4. Open your browser and go to: **[http://localhost:5173](http://localhost:5173)**.

---

## 4. Running with Docker (Alternative)

If you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed, you can launch the entire stack with a single command without installing Python or Node.js locally:

```bash
docker compose up --build
```

- **Frontend Container**: Nginx serving the production React build on `http://localhost:5173`.
- **Backend Container**: FastAPI running on `http://localhost:8000`.
- **Storage Volume**: Local `./data` directory mounted into `/app/data` to cache Parquet files.

To stop the containers:
```bash
docker compose down
```

---

## 5. Application URLs & Access Points

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Web Portal** | `http://localhost:5173` | Complete interactive WINDLENS user interface |
| **Backend Interactive API Docs** | `http://localhost:8000/docs` | Swagger UI with testable endpoints & schema definitions |
| **Backend Alternative API Docs** | `http://localhost:8000/redoc` | ReDoc interactive technical API documentation |
| **Backend Health Check** | `http://localhost:8000/api/health` | Service uptime and status check |
| **Overview API Endpoint** | `http://localhost:8000/api/overview` | JSON metrics, time series, and data quality summary |
| **CSV Data Export** | `http://localhost:8000/api/export` | Download matched intervals and error metrics as CSV |

---

## 6. Running the Automated Test Suite

WINDLENS includes a test suite covering domain logic, timezone boundaries, cutoff enforcement, tie-breaking, and statistical calculations:

```bash
# Navigate to the backend directory
cd backend

# Run all tests with verbose output
pytest tests/ -v
```

### What the Tests Verify:
- **Wind Generation Filtering**: Validates only `fuelType == 'WIND'` records are retained from the FUELHH stream.
- **Date & Settlement Boundaries**: Confirms strict January 2026 delivery bounds (1,488 half-hour intervals).
- **Decision Cutoff Enforcement**: Guarantees zero future-information leakage by rejecting any forecast published after D-1 23:59 GMT.
- **Hourly-to-Half-Hourly Matching**: Asserts correct piecewise-constant step mapping from WINDFOR hourly blocks to FUELHH 30-minute settlement intervals.
- **Mathematical Integrity**: Validates MAE, RMSE, MBE, and zero-actual exclusion in MAPE.
- **API Integration & Resilience**: Tests all 8 FastAPI routes, retry mechanisms, and error handling.


