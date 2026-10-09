# CarIQ Admin API — curl cheat sheet

Base URL examples use `http://localhost:8000`. Admin routes live under
`/api/v1/admin/` and use httpOnly cookies, so every example below uses
`curl -b cookies.txt -c cookies.txt` (cookie jar) plus the CSRF header
for state-changing requests.

> **Cookie note:** admin cookies are `SameSite=None; Secure` so the session
> works both same-origin (local dev proxy, docker nginx) and cross-origin
> (static frontend + separate API domain). State-changing requests additionally
> require the `X-CSRF-Token` double-submit header, so cross-site request
> forgery stays blocked. If your browser blocks all third-party cookies,
> allow them for the frontend origin or use the admin locally.

## 0. First admin (server, no signup endpoint exists)

```bash
cd backend
python scripts/create_admin.py --email you@example.com --role admin
```

## 1. Login / session

```bash
# Login (5/min/IP; generic error for bad user/password/locked)
curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}'

# Grab the CSRF token from the cookie jar for the calls below
CSRF=$(grep cariq_admin_csrf cookies.txt | awk '{print $NF}')

# Who am I
curl -b cookies.txt http://localhost:8000/api/v1/admin/auth/me

# Refresh (rotates both tokens; needs CSRF header)
curl -b cookies.txt -c cookies.txt -X POST http://localhost:8000/api/v1/admin/auth/refresh \
  -H "X-CSRF-Token: $CSRF"

# Logout
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/auth/logout \
  -H "X-CSRF-Token: $CSRF"
```

## 2. Knowledge base

```bash
# List (search, status filter, pagination)
curl -b cookies.txt 'http://localhost:8000/api/v1/admin/kb/models?q=polo&status=live&page=1'

# Get one model with all sections
curl -b cookies.txt http://localhost:8000/api/v1/admin/kb/models/vw_polo

# Create (status starts as draft)
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/kb/models \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"make":"Toyota","model":"Corolla","variants":["1.8 XS"],"reliability_score":8.5,"faults":[],"price_ranges":[],"checklist":[]}'

# Update profile section (editors allowed)
curl -b cookies.txt -X PUT http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/profile \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"make":"Toyota","model":"Corolla","reliability_score":9.0}'

# Replace faults / prices / checklist
curl -b cookies.txt -X PUT http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/faults \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '[{"title":"CVT shudder","severity":"medium","repair_min_zar":5000,"repair_max_zar":12000}]'

# Add one fault
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/faults \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"title":"CVT shudder","severity":"HIGH"}'

# Edit / delete one fault
curl -b cookies.txt -X PATCH http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/faults/3 \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"title":"CVT shudder","severity":"MEDIUM"}'
curl -b cookies.txt -X DELETE http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/faults/3 \
  -H "X-CSRF-Token: $CSRF"

# Soft-delete / restore (admin role only)
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/soft-delete \
  -H "X-CSRF-Token: $CSRF"
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/restore \
  -H "X-CSRF-Token: $CSRF"

# Diff working copy vs last published
curl -b cookies.txt http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/diff

# Publish (admin only) -> returns {"job_id"}; poll for done
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/publish \
  -H "X-CSRF-Token: $CSRF"
curl -b cookies.txt http://localhost:8000/api/v1/admin/sync/jobs/1

# Versions + rollback (rollback restores as a NEW draft)
curl -b cookies.txt http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/versions
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/rollback/7 \
  -H "X-CSRF-Token: $CSRF"

# Export legacy JSON for a model
curl -b cookies.txt http://localhost:8000/api/v1/admin/kb/models/toyota_corolla/export

# Audit log (read-only, filterable)
curl -b cookies.txt 'http://localhost:8000/api/v1/admin/kb/audit?action=kb.publish&page=1'
```

## 3. Sync & health

```bash
curl -b cookies.txt http://localhost:8000/api/v1/admin/sync/health
curl -b cookies.txt http://localhost:8000/api/v1/admin/sync/jobs?status=failed

# Full reindex (admin only, one at a time, needs explicit confirm)
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/sync/reindex-all \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"confirm":true}'
```

## 4. Failed questions

```bash
curl -b cookies.txt 'http://localhost:8000/api/v1/admin/overview'
curl -b cookies.txt 'http://localhost:8000/api/v1/admin/failures/groups?reason=low_score&status=open'
curl -b cookies.txt http://localhost:8000/api/v1/admin/failures/groups/4
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/failures/groups/4/resolve \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"note":"Added 2021 band data"}'
curl -b cookies.txt http://localhost:8000/api/v1/admin/failures/groups/4/prefill
```

## 5. Public feedback (no auth, 30/min)

```bash
curl -X POST http://localhost:8000/api/v1/feedback \
  -H 'Content-Type: application/json' \
  -d '{"query_id":123,"vote":"down"}'
```

## 6. Users (admin role only)

```bash
curl -b cookies.txt http://localhost:8000/api/v1/admin/users
curl -b cookies.txt -X POST http://localhost:8000/api/v1/admin/users \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"ed@example.com","password":"long-enough-1","role":"editor"}'
curl -b cookies.txt -X PATCH http://localhost:8000/api/v1/admin/users/2 \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d '{"disabled":true}'
```

## 7. Seed / migration helpers

```bash
cd backend
psql $DATABASE_URL -f migrations/001_admin_kb.sql   # existing DBs only; fresh DBs auto-create
python scripts/import_json_to_db.py                 # idempotent JSON -> DB seed
python scripts/ingest.py                            # unchanged JSON -> Pinecone flow
```
