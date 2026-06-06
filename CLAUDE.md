@AGENTS.md

# ANG Flight Log App — Claude Code Context

## Project Overview
This is a Next.js flight log application built for aviation operations. It scans and processes paper flight logs, tracks fuel dockets, monitors engine trend data, and provides analytics across flight operations.

The app is live and in production. I (Ethan) am a business partner working on a **separate development copy** of the codebase. My role is to:
- Explore and analyse the existing data
- Build new dashboards and visualisations
- Develop new features and applications for clients
- Test new ideas without affecting the live product

---

## My Environment
- **Local project path:** `/Users/ethannhill/Library/CloudStorage/OneDrive-Kingsleyhill.com.au/Ethan Work - 2026/flight-log-app-main`
- **My GitHub repo:** `https://github.com/ethannhill/ANG-Flight-Log-App-Test-Base`
- **Run locally:** `npm run dev` → `http://localhost:3000`
- **Node version:** v24.16.0

---

## Database
- **Host:** Azure PostgreSQL 16 (`flight-log-db.postgres.database.azure.com`)
- **Connection:** Configured in `.env.local` as `DATABASE_URL`
- **User:** `ethan_readonly` — **READ ONLY**
- **DB helper:** `lib/db.ts` — use the `query()` function for all database calls

### ⚠️ Critical Database Rules
- **DO NOT** attempt any INSERT, UPDATE, DELETE or DROP operations
- **DO NOT** modify the schema or run migrations against the live database
- This is a shared live production database — reads only, always
- If a feature requires writes, build against a local Postgres instance instead

### Tables & Row Counts
| Table | Rows | Description |
|---|---|---|
| `historical_flights` | 7,149 | Core flight records — times, fuel, pax, stations, crew |
| `aircraft_details` | 10 | Aircraft register — reg, make, model, operator |
| `scanned_flight_logs` | 11 | Scanned paper flight logs |
| `scanned_sectors` | 26 | Individual sector data from scanned logs |
| `scanned_trend_data` | 4 | Engine performance data — temps, fuel flow, torque |
| `scanned_fuel_dockets` | 2 | Fuel uplift records |
| `app_users` | 2 | User accounts |
| `api_usage` | — | API call tracking |
| `app_config` | — | App configuration settings |
| `scanned_log_images` | — | Images from scanned logs |

### Key Columns — historical_flights
`id, log_number, flight_number, aircraft_reg, operation, departure_date, captain, client, depart_stn, arrival_stn, off_block, take_off, land, on_block, flight_time, block_time, landings, fuel_burn_kg, pax, delay_minutes, source, source_file, imported_at`

---

## What I'm Building
1. **Dashboards** — live charts and KPIs using real flight data (flight hours, fuel burn, utilisation, routes)
2. **Data exploration** — querying and analysing the dataset to find insights
3. **New client-facing applications** — standalone tools and features built on top of the database
4. **New features** — extending the existing app (upload, reconciliation, analytics, reporting)

---

## Development Rules
- Always work on a **new branch**, never commit directly to `main`
- Create a new branch for each feature: `git checkout -b feature/my-feature-name`
- The `main` branch mirrors the live product — do not touch it
- Test everything locally before pushing
- Never commit `.env.local` or any credentials
- Keep the existing app structure and conventions consistent

---

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Database:** PostgreSQL via `pg` (connection pool in `lib/db.ts`)
- **Auth:** iron-session
- **AI:** Anthropic SDK (@anthropic-ai/sdk)
- **Storage:** Azure Blob Storage

---

## Useful Commands
```bash
npm run dev        # Start local dev server
npm run build      # Build for production
npm run lint       # Run linter
git checkout -b feature/name   # Start a new feature branch
git push -u origin feature/name  # Push branch to GitHub
```
