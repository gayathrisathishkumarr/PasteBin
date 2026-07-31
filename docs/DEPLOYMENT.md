# Deployment guide

PasteBin is fully runnable in Docker today. The production deployment decision depends on whether persistent data or a completely free hosting plan is more important.

## Best evaluator deployment: one Docker host

Deploy the existing `docker-compose.yml` to a single host with a persistent disk and a public HTTPS endpoint. This requires no application code changes.

1. Copy the repository to the host.
2. Create `.env` from `.env.example` and set `CORS_ORIGIN` to the final HTTPS domain.
3. Run `docker compose up --build -d`.
4. Put a TLS-enabled reverse proxy in front of port `8080`.
5. Back up the Docker volume named `paste_data` regularly.

This preserves the SQLite database because the API stores it in the named Docker volume.

## About free hosting

The current database is SQLite. Many free web hosts use temporary filesystems, which can erase SQLite data when a service restarts or redeploys. Do not present such a deployment as persistent.

For a permanently stored, fully free public demo, first migrate the database layer to hosted PostgreSQL. Then deploy:

| Component | Suggested service | Notes |
| --- | --- | --- |
| Web client | Vercel | Deploy the Vite build and set the API origin. |
| Express API | Render | Configure the PostgreSQL connection and production CORS origin. |
| Database | Supabase or Neon | Store the PostgreSQL database and backups. |

## Environment values for a public deployment

Use the hosting provider’s secret/environment-variable screen, never Git, for values such as:

```text
PORT=3001
CORS_ORIGIN=https://your-public-web-domain.example
RATE_LIMIT_MAX=300
BODY_LIMIT=150kb
```

For a PostgreSQL migration, add a database connection variable such as `DATABASE_URL`. The current release intentionally uses `DATABASE_PATH` for SQLite instead.

## Post-deployment verification

1. Visit `/health` and confirm `status: ok`.
2. Visit `/ready` and confirm `database: connected`.
3. Create a paste, refresh, and retrieve it through its direct URL.
4. Verify the public Explore view excludes unlisted, secret, and expired pastes.
5. Confirm `/api-docs` and `/openapi.json` are reachable.
6. Check that the GitHub Actions workflow is green for the deployed commit.
