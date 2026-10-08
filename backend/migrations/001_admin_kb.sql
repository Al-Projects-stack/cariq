-- 001_admin_kb.sql — Admin dashboard + KB management + failure tracking
--
-- Target: PostgreSQL (production). Fresh databases do NOT need this file:
-- app/main.py runs Base.metadata.create_all() on startup, which creates
-- every table below from app/db/models.py automatically.
--
-- Run this ONLY against an existing database created before this migration:
--   psql $DATABASE_URL -f backend/migrations/001_admin_kb.sql
--
-- Safe to run twice: every statement uses IF NOT EXISTS.
-- NOTE: SQLite (local dev / Render free tier file DB) does not support
-- ADD COLUMN IF NOT EXISTS. For SQLite, delete the .db file and let
-- create_all() rebuild it, or run the ADD COLUMN lines manually once.

-- --- Admin users ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'editor',
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP NULL,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_admin_users_email ON admin_users (email);

CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_admin_refresh_tokens_user ON admin_refresh_tokens (admin_user_id);
CREATE INDEX IF NOT EXISTS ix_admin_refresh_tokens_hash ON admin_refresh_tokens (token_hash);

-- --- Knowledge base (live content) ------------------------------------------
CREATE TABLE IF NOT EXISTS kb_models (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(200) NOT NULL UNIQUE,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    variants TEXT NOT NULL DEFAULT '[]',
    years_covered VARCHAR(50) NOT NULL DEFAULT '',
    sa_market_summary TEXT NOT NULL DEFAULT '',
    reliability_score FLOAT NOT NULL DEFAULT 0.0,
    segment VARCHAR(100) NOT NULL DEFAULT '',
    fuel_type VARCHAR(50) NOT NULL DEFAULT '',
    fuel_consumption_l_per_100km FLOAT NULL,
    annual_maintenance_zar INTEGER NULL,
    annual_insurance_zar INTEGER NULL,
    owner_sentiment TEXT NOT NULL DEFAULT '',
    sources TEXT NOT NULL DEFAULT '[]',
    published_version_id INTEGER NULL,
    published_at TIMESTAMP NULL,
    chunk_ids TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_kb_models_slug ON kb_models (slug);
CREATE INDEX IF NOT EXISTS ix_kb_models_make ON kb_models (make);
CREATE INDEX IF NOT EXISTS ix_kb_models_model ON kb_models (model);

CREATE TABLE IF NOT EXISTS kb_faults (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES kb_models (id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    mileage_range VARCHAR(100) NOT NULL DEFAULT '',
    what_to_inspect TEXT NOT NULL DEFAULT '',
    repair_min_zar INTEGER NULL,
    repair_max_zar INTEGER NULL,
    affected_variants TEXT NOT NULL DEFAULT '[]',
    affected_years TEXT NULL,
    source VARCHAR(500) NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_kb_faults_model ON kb_faults (model_id);

CREATE TABLE IF NOT EXISTS kb_price_ranges (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES kb_models (id) ON DELETE CASCADE,
    year_from INTEGER NOT NULL,
    year_to INTEGER NOT NULL,
    low_zar INTEGER NOT NULL,
    mid_zar INTEGER NOT NULL,
    high_zar INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_kb_price_ranges_model ON kb_price_ranges (model_id);

CREATE TABLE IF NOT EXISTS kb_checklist_items (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES kb_models (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_kb_checklist_model ON kb_checklist_items (model_id);

CREATE TABLE IF NOT EXISTS model_versions (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES kb_models (id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL,
    snapshot TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_model_versions_model ON model_versions (model_id);

-- --- Audit + sync jobs (append-only / status only) ---------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    actor VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    model_slug VARCHAR(200) NULL,
    detail TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_audit_log_actor ON audit_log (actor);
CREATE INDEX IF NOT EXISTS ix_audit_log_action ON audit_log (action);

CREATE TABLE IF NOT EXISTS sync_jobs (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL,
    model_slug VARCHAR(200) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    error TEXT NULL,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS ix_sync_jobs_status ON sync_jobs (status);

-- --- Failure tracking --------------------------------------------------------
CREATE TABLE IF NOT EXISTS failed_question_groups (
    id SERIAL PRIMARY KEY,
    normalized TEXT NOT NULL UNIQUE,
    sample_question TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    reason VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    note TEXT NULL,
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_failed_groups_reason ON failed_question_groups (reason);
CREATE INDEX IF NOT EXISTS ix_failed_groups_status ON failed_question_groups (status);

-- --- Extend query_logs (new columns for failure tracking) --------------------
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS retrieved_chunk_ids TEXT NULL;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS scores TEXT NULL;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS top_score FLOAT NULL;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS refused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS response_time_ms INTEGER NULL;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(128) NULL;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS vote VARCHAR(10) NULL;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(50) NULL;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS group_id INTEGER NULL
    REFERENCES failed_question_groups (id);
