# Migrations

Alembic is a dependency but was never initialized in this repo, so migrations
are plain SQL scripts. Fresh databases need nothing: `app/main.py` runs
`Base.metadata.create_all()` on startup.

## Applying to an existing database (PostgreSQL)

```bash
psql $DATABASE_URL -f backend/migrations/001_admin_kb.sql
```

All statements use `IF NOT EXISTS`, so re-running is safe.

## SQLite (local dev)

SQLite does not support `ADD COLUMN IF NOT EXISTS`. Easiest path: delete the
`.db` file and restart the backend — `create_all()` rebuilds everything,
including the new columns and tables.

## Scripts

| File              | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `001_admin_kb.sql`| Admin users, KB tables, versions, audit, jobs, failure groups |
