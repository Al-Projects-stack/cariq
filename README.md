# CarIQ

**South African Used Car Market Intelligence**

<img width="1082" height="617" alt="CarIQ screenshot" src="https://github.com/user-attachments/assets/0a747dfa-cca9-4266-99c5-efd1c71ab4df" />

**Live:** https://cariq-frontend.onrender.com

Ask plain-English questions about used car prices, reliability, and known faults in the South African market. Get grounded, sourced answers in seconds.

---

## What it does

CarIQ is a RAG-powered web app for South African used car buyers. Instead of trawling forum threads and AutoTrader listings, you ask something like *"Is R280,000 fair for a 2019 BMW 3 Series?"* or *"What are the known faults on a VW Polo Vivo?"* — and get a structured, sourced answer drawn from a curated knowledge base.

Every answer comes with:

| Panel | What you get |
|---|---|
| Written analysis | Grounded in the knowledge base, priced in Rand |
| Price Intelligence | Low / mid / high ranges plus a verdict: GOOD DEAL, FAIR, ABOVE MARKET, or OVERPRICED |
| Known Faults | Faults by severity, typical mileage, and repair cost in ZAR |
| Source citations | Every claim traceable to its source |

Beyond Q&A, the app includes side-by-side model comparison, a market position indicator versus segment peers, 3-year total cost of ownership estimates, a needs-based recommendation quiz, follow-up questions with conversation memory ("what about the diesel one?"), thumbs up/down feedback on answers, and a WhatsApp chatbot for asking on the go.

---

## How it works

```
User asks a question
        │
        ▼
┌───────────────────────────────┐
│  React frontend               │
│  TypeScript + Tailwind        │──► POST /api/v1/query
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  FastAPI backend              │
│                               │
│  1. Rewrite follow-up into a  │
│     standalone question       │
│  2. Embed (384-dim vector)    │
│  3. Retrieve top-5 chunks     │──► Pinecone (cosine similarity)
│  4. Generate grounded answer  │──► Claude (context only, ZAR only)
│  5. Parse panels + log query  │──► PostgreSQL
└───────────────────────────────┘
        │
        ▼
  Answer + Price Intelligence + Known Faults + Sources
```

The knowledge base (27 SA car models) is chunked — one chunk per fault, per price band, per inspection checklist, plus a market summary — embedded with `BAAI/bge-small-en-v1.5`, and stored in Pinecone. The model answers strictly from retrieved chunks: no fabricated prices, verdicts from an approved vocabulary, refusals for models outside the knowledge base.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI |
| AI | Claude API |
| Embeddings | fastembed (`BAAI/bge-small-en-v1.5`, 384 dims) |
| Vector store | Pinecone (`cariq-kb`, cosine) |
| Database | PostgreSQL (SQLite for local file fallback) |
| Caching | In-memory TTL cache with LRU eviction |
| Containerisation | Docker, Docker Compose |
| Deployment | Render |

---

## Run it locally

Prerequisites: Python 3.11+, Node.js 20+, an Anthropic API key, and a Pinecone account (free tier — create index `cariq-kb`, 384 dimensions, cosine metric).

```bash
# 1. Clone and configure
git clone https://github.com/Al-Projects-stack/cariq.git
cd cariq
cp backend/.env.example backend/.env
# Fill in the API keys in backend/.env

# 2. Install and ingest the knowledge base
cd backend
pip install -r requirements.txt
python scripts/ingest.py

# 3. Start the backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. Start the frontend (new terminal)
cd ../frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Or the full stack with Docker:

```bash
docker-compose up --build
```

---

## Knowledge base

Lives in `backend/knowledge_base/cars/` — one JSON file per model covering price ranges, known faults, inspection checklists, reliability scores, and owner sentiment. Run `python scripts/ingest.py` after adding new files (or `python scripts/ingest.py toyota_starlet kia_sonet` for just those). These files also seed the admin-managed database (below).

### Keeping prices current

Each model records `prices_verified_at`, the date its price bands were last checked against the market. Between checks, `app/services/pricing.py` ages every served price month by month along an SA depreciation curve (15%/yr for cars under 3 years old, easing to 6%/yr past 10), so a 2019 band verified in May is cheaper by October. This applies everywhere prices appear: profiles, compare, market position, TCO, recommendations, and chatbot answers (retrieved price chunks are aged at query time, and the answer notes the adjustment).

Ageing is an estimate, not live data: it can't capture market-wide price rises. So any model unverified for 90+ days is flagged on the admin **System Health** page, and ageing stops at 18 months. To re-verify, update the bands and `prices_verified_at` in the JSON and re-ingest that model.

---

## Admin dashboard

A secure area at `/admin` for managing the knowledge base without touching JSON files, plus visibility into failing user questions.

What it covers:

- **Knowledge base editing** — tabbed model editor with inline validation, draft saving, and diff previews
- **Publish workflow** — drafts go live to Pinecone only on publish, with background sync jobs you can poll
- **Version history** — every save snapshots the full model; roll back to any version as a new draft
- **Failed questions** — groups of low-score, refused, or down-voted queries ranked by frequency, with retrieval debug and one-click entry creation
- **System health** — Pinecone vector counts vs expected, reindex controls, cache stats, background jobs
- **Audit log + users** — append-only action log, admin/editor roles

### Create the first admin

There is no public signup for admins. On the server (or any machine with `DATABASE_URL` pointing at it):

```bash
cd backend
python scripts/create_admin.py --email you@example.com --role admin
# password is read from an interactive prompt, never from argv
```

Then open `/admin/login`. Editors can edit drafts but cannot publish,
delete, or manage users. Full endpoint reference: `docs/admin-api.md`.

> **Ephemeral SQLite note:** if the backend runs on SQLite on throwaway disk
> (e.g. Render free tier), the database — and any admin in it — is wiped on
> every deploy. For hosting like that, set `ADMIN_EMAIL` + `ADMIN_PASSWORD`
> env vars instead: the app recreates that admin on every startup.

---

## WhatsApp chat

Ask car questions via WhatsApp instead of the web UI. Twilio delivers incoming messages to `POST /api/v1/whatsapp`, which validates the Twilio request signature, runs the question through the same RAG pipeline as the web app, and replies with a TwiML message.

### What it does

- Send a plain-English question (e.g. *"Is R280,000 fair for a 2019 BMW 3 Series?"*) to the CarIQ WhatsApp number
- Receive a grounded, sourced answer as a WhatsApp reply
- Get a friendly hint if you send media or an empty message
- Long answers are trimmed to stay under Twilio's 1600-character message limit

### How it works

```
Twilio sends incoming WhatsApp message
        │
        ▼
┌───────────────────────────────┐
│  FastAPI backend              │
│                               │
│  1. Validate Twilio signature │──► 403 if invalid / missing
│  2. Run RAG pipeline          │──► Claude + Pinecone (same as web)
│  3. Trim to ~1500 chars       │──► stays under Twilio's 1600-char limit
│  4. Reply with TwiML          │──► 200 even on RAG errors (avoids retry storms)
└───────────────────────────────┘
        │
        ▼
   WhatsApp reply delivered to user
```

### Set it up

1. Add `TWILIO_AUTH_TOKEN` to `backend/.env` (from Twilio Console) — never commit it
2. In Render (or your host), set `TWILIO_AUTH_TOKEN` as an environment variable on the backend service
3. In Twilio Console → your WhatsApp sender → "When a message comes in" webhook:
   - URL: `https://<your-backend-host>/api/v1/whatsapp`
   - Method: `POST`
4. Behind a TLS proxy (e.g. Render), launch uvicorn with `--forwarded-allow-ips="*"` so Twilio signature validation sees the public URL

---

## Security

- Pydantic validation on every request, unknown fields rejected
- Prompt injection screening on questions, history, and admin-saved content
- Cookie-session admin auth: short-lived JWTs, rotating refresh tokens, CSRF tokens, lockout after 10 failed attempts
- Rate limiting per IP (10 queries/min, 10 user logins/min, 5 signups/min, 5 admin logins/min)
- User and admin tokens signed with `JWT_SECRET`; auth refuses to run in production on the default value
- Security headers on every response, `no-store` on admin responses
- CORS locked to `FRONTEND_URL` in production
- Salted hashes for user IPs and WhatsApp numbers in logs — plain IPs and phone numbers are never stored
- Secrets in environment variables only, never committed

---

## Known limitations

- Knowledge base is manually curated — no real-time listings data
- Prices reflect SA market conditions as of early 2025
- Questions about models outside the knowledge base get a refusal, not a guess
- English only

---

*Built by Al Mujati · 2025–ongoing*

## What I learnt

- Building a RAG pipeline end to end: chunking a JSON knowledge base, embedding each chunk with fastembed, upserting to Pinecone, and retrieving the top K chunks at query time
- The difference between retrieval failures and generation failures, and how to diagnose which layer is producing a bad answer
- Designing prompts that force the model to answer only from retrieved context and refuse questions outside the knowledge base
- Conversation memory for RAG: rewriting follow-ups into standalone questions before embedding, so "what about the diesel one?" retrieves correctly
- Containerizing a Python + React stack with Docker Compose and managing secrets cleanly across local dev and Render
- Car comparison: loading two car profiles, normalising their fields, and rendering reliability scores, price tables, fault severity breakdowns, and inspection checklists side by side
- Market position: classifying a car into a segment and computing where its price falls relative to peers, surfaced as a simple value label
- Total cost of ownership: estimating real 3-year ownership cost (purchase + fuel + insurance + maintenance) with a monthly breakdown
- Recommendation quiz: scoring each model against budget, body type, and priorities into a ranked shortlist with reasons
- TTL caching: a thread-safe in-memory cache with LRU eviction, hit/miss stats, and per-endpoint TTLs to survive free-tier limits
- Cookie-session auth with roles: short-lived JWT access cookies, rotating refresh cookies, double-submit CSRF, brute-force lockout with generic errors, backend-enforced admin/editor roles
- Draft/publish/versioning: snapshot rows on every save, live markers flipping only after successful sync, rollback as a new draft — and the SQLAlchemy lesson that deleted rows linger in already-loaded relationship collections until expired
- Deterministic Pinecone sync: one shared chunking module, `{slug}_{section}_{index}` vector IDs so republishes overwrite instead of duplicating, upsert-before-delete so failures never zero out a model, DB-backed background jobs
