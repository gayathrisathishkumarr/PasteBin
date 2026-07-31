# PasteBin demo script

This is a concise, three-minute walkthrough for the optional demo video. Record the browser window and terminal only; do not show `.env` files, tokens, or personal notifications.

## Before recording

1. Run `npm run dev` and open the displayed local URL.
2. Create two public pastes in the same language. Fork one of them so the Code Lineage Map has a clear connection to show.
3. Keep a terminal ready with `npm test` and the GitHub Actions page open in another tab.

## 0:00-0:20 — What this is

Say: “PasteBin is a full-stack platform for creating, managing, retrieving, and sharing text or code snippets. It uses a React client, an Express REST API, and a persistent SQLite database.”

Show the Dashboard, the health indicators, and the Code Lineage Map.

## 0:20-1:05 — Core workflow

1. Select **New Paste**.
2. Use the Java template or upload a `.java` file.
3. Add a title, tags, and Public visibility, then create the paste.
4. Open the new paste, copy its direct link, and refresh the page to show that it persists.
5. Show raw view or download to demonstrate sharing.

Say: “The web interface communicates with the REST API. Input is validated on the server and stored persistently.”

## 1:05-1:45 — Standout features

1. Edit the paste, open revision history, compare versions, and restore one as a new version.
2. Fork/remix a public paste.
3. Return to the Dashboard and select the relationship in the Code Lineage Map.

Say: “The lineage map is explainable: it shows persisted fork relationships and deterministic structural similarity. It does not upload source code to an AI service.”

## 1:45-2:20 — Secure sharing

1. Create a short-lived paste and show its expiration option.
2. Create a Secret paste.
3. Open it once after accepting the warning, then refresh or reopen the link to show it is unavailable.

Say: “Secret pastes are deleted atomically when read, so only one request can receive the content.”

## 2:20-2:45 — API and operations

1. Open **API Playground** and run `/health` or `/api/pastes`.
2. Open `/api-docs` and briefly show the API documentation.
3. Show the Dashboard’s real analytics and activity.

Say: “The API includes health, readiness, and non-sensitive metrics endpoints, structured logs, request IDs, validation, and rate limiting.”

## 2:45-3:00 — Engineering evidence

1. Show `npm test` passing in the terminal.
2. Show the green GitHub Actions workflow.
3. Briefly show the README architecture diagram and Docker Compose command.

Say: “The project is containerized with Docker and Docker Compose, has automated tests and CI, and documents setup, architecture, API routes, and operational decisions.”

## Recording checklist

- Keep it under 3 minutes.
- Record at readable browser zoom.
- Do not show passwords, API keys, `.env`, or unrelated desktop notifications.
- Upload the finished video to Google Drive or YouTube as unlisted, then add the link to the README.
