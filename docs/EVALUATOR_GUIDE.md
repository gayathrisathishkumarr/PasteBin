# PasteBin Evaluator Guide

## System overview

PasteBin is a full-stack developer snippet workspace. A React and TypeScript SPA communicates with an Express REST API through a same-origin Vite or Nginx proxy. The API validates input with Zod and persists current pastes, immutable revisions, activity, and view events in SQLite. The repository includes automated integration tests, structured logging, operational endpoints, Docker images, Docker Compose, and GitHub Actions verification.

The application deliberately avoids authentication, accounts, payments, and simulated information. “My Pastes” represents the local shared workspace, and every statistic or activity item is derived from persisted data.

## Rubric-to-feature mapping

| Rubric area | Evidence in PasteBin |
|---|---|
| System Design | Separate web/API containers; same-origin proxy boundary; versioned relational schema; public/unlisted/secret lifecycle rules; transactional revisions, forks, and secret retrieval; architecture diagram |
| Backend Architecture | Express middleware pipeline; centralized validation and error envelopes; request IDs; allowlisted sorting; parameterized SQL; pagination; OpenAPI; health/readiness/metrics; graceful shutdown |
| Code Quality | Strict TypeScript; shared API and domain types; reusable upload-type logic; error boundary; accessible component contracts; focused Vitest and Supertest coverage; no fake or unfinished product surfaces |
| DevOps | Multi-stage web image; independent API image; Compose health checks and startup ordering; named SQLite volume; environment configuration; GitHub Actions tests, build, Compose validation, and image builds |
| Documentation | Quick start; requirements matrix; architecture; database design; complete route table; curl examples; security rationale; deployment guidance; tradeoffs; evaluator walkthrough |
| Creativity | Paste Studio with draft recovery and templates; atomic burn-after-reading; revision comparison and restoration; fork/remix lineage; client-side QR sharing; command palette; real activity and analytics; safe API Playground |

## Polished three-minute demonstration

### 0:00–0:30 — Architecture and operational readiness

1. Open the Dashboard at <http://localhost:5173>.
2. Point out that totals, language bars, recent activity, API health, database readiness, and uptime are loaded from the API rather than hard-coded.
3. Briefly show `/health`, `/ready`, and `/metrics`.

### 0:30–1:20 — Core paste workflow

1. Open **New Paste** with `Ctrl/Cmd + K`.
2. Choose the Java template or upload a `.java` file.
3. Add a description and tags, keep visibility Public, and create the paste.
4. Refresh the direct paste URL to demonstrate stable routing and persistence.
5. Copy content, download the `.java` source, and show that the QR code is generated locally.

### 1:20–2:10 — Management and collaboration

1. Edit the paste twice and open Revision History.
2. Compare an older revision with the current version, then restore the older revision as a new version.
3. Favorite the paste and fork it; point out source attribution and the original fork count.
4. Open **My Pastes**, change grid/list view, filter by Java, sort, and show URL-persisted filters.
5. Open **Explore** and explain that only active public pastes are returned.

### 2:10–3:00 — Reliability and advanced lifecycle

1. Create an expiring paste and explain the consistent `410 EXPIRED` behavior.
2. Create a Secret paste, show the explicit warning, open it once, and demonstrate that the second retrieval returns unavailable.
3. Open Analytics and emphasize that all charts use SQLite aggregates and event records.
4. Open API Playground and run a safe GET request.
5. Finish with `npm test`, `npm run build`, and the GitHub Actions workflow.

## Commands

### Local development

```bash
cp .env.example .env
npm install
npm run dev
```

### Automated tests

```bash
npm test
```

### Production build

```bash
npm run build
```

### Docker Compose

```bash
docker compose config
docker compose up --build
docker compose down
```

Use `docker compose down -v` only when intentionally deleting the persisted SQLite volume.

## Important URLs

When using `npm run dev`, the web routes are available through the Vite origin and directly from the API on port `3001`.

| Surface | URL |
|---|---|
| Application | <http://localhost:5173> |
| API health | <http://localhost:3001/health> |
| API readiness | <http://localhost:3001/ready> |
| Operational metrics | <http://localhost:3001/metrics> |
| Human-readable API docs | <http://localhost:3001/api-docs> |
| OpenAPI JSON | <http://localhost:3001/openapi.json> |

With Docker Compose, open the application at <http://localhost:8080>; the same operational and documentation paths are proxied through that origin.

## Interview-ready technical decisions and tradeoffs

- **Why SQLite?** It makes the challenge reproducible and operationally small while still supporting transactions, foreign keys, indexes, WAL, migrations, and atomic one-time retrieval. PostgreSQL is the intended multi-node evolution.
- **Why no authentication?** The challenge centers on storing and sharing pastes. Incomplete identity would create misleading “private” guarantees, so the UI truthfully uses Public, Unlisted, and Secret.
- **How is burn-after-reading safe?** Lookup and deletion occur in one synchronous SQLite transaction. Concurrent or repeated retrieval tests prove that exactly one request receives the content.
- **How are public boundaries enforced?** Public list queries explicitly require Public visibility and exclude expired/secret records at the SQL layer, rather than relying on client filtering.
- **Why same-origin proxying?** It keeps local fallback ports and the container deployment consistent, avoids hard-coded browser API origins, and reduces CORS failure modes.
- **How are revisions modeled?** The current row remains fast to query; every edit snapshots the previous state in an immutable revisions table. Restoration creates another version rather than rewriting history.
- **Why event tables?** Activity and view events make dashboard and time-series analytics genuine and auditable without fabricated trends.
- **What is intentionally lightweight?** Syntax presentation is dependency-light and line-numbered. A production evolution could add worker-based Shiki highlighting and Playwright/axe visual accessibility checks.
