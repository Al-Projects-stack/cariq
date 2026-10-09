# CarIQ
South African Used Car Market Intelligence
<img width="1082" height="617" alt="image" src="https://github.com/user-attachments/assets/0a747dfa-cca9-4266-99c5-efd1c71ab4df" />


**Live:** https://cariq-frontend.onrender.com

Ask plain-English questions about used car prices, reliability, and known faults in the South African market. Get grounded, sourced answers in seconds.

---

## What CarIQ Does

CarIQ is a RAG-powered web application built for South African used car buyers. Instead of trawling through forum threads and AutoTrader listings, you ask CarIQ a question like *"Is R280,000 fair for a 2019 BMW 3 Series?"* or *"What are the known faults on a VW Polo Vivo?"* and receive a structured, sourced answer drawn from a curated knowledge base covering popular SA car models.

The app returns:
- A written analysis grounded in the knowledge base
- A **Price Intelligence panel** with low/mid/high price ranges and a market verdict (GOOD DEAL / FAIR / ABOVE MARKET / OVERPRICED)
- A **Known Faults panel** listing faults by severity, mileage range, and repair cost in ZAR
- **Source citations** for every answer
- **Side by side model comparison** with reliability, price, and fault comparisons
- **Market position indicator** showing where a model sits vs its segment peers on price
- **3 year total cost of ownership** including purchase, fuel, insurance, and maintenance
- **Needs based car recommendation quiz** takes your budget, body type, and priorities and returns a ranked shortlist
- **Follow-up questions** with conversation memory - ask "what about the diesel one?" without repeating context
- **Answer feedback** with thumbs up/down to flag unhelpful answers for review

---

## Architecture

```
User
  │
  ▼
React Frontend (TypeScript + Tailwind CSS)
  │  POST /api/v1/query
  ▼
FastAPI Backend (Python)
  │
  ├─► RAG Service
  │     │
  │     ├─► Embeddings (fastembed / BAAI/bge-small-en-v1.5)
  │     │     └─► 384-dim query vector
  │     │
  │     ├─► Pinecone Vector Store
  │     │     └─► Top 5 relevant KB chunks (cosine similarity)
  │     │
  │     └─► AI API (language model)
  │           └─► Grounded, structured answer
  │
  ├─► PostgreSQL (query logging, feedback, KB content)
  │
  └─► Knowledge Base (JSON files → Pinecone, admin-managed via /admin)
        └─► 20 SA car models, chunked and embedded
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI |
| AI | AI API (language model) |
| Embeddings | fastembed (`BAAI/bge-small-en-v1.5`, 384 dims) |
| Vector Store | Pinecone |
| Database | PostgreSQL |
| Containerisation | Docker, Docker Compose |
| Deployment | Render |

---

## How the RAG Pipeline Works

1. **Ingestion** JSON files in `backend/knowledge_base/cars/` are chunked into meaningful units: one chunk per known fault, one per price range, one inspection checklist, one market summary per model. Each chunk is embedded using `BAAI/bge-small-en-v1.5` and upserted into Pinecone with rich metadata.

2. **Query** The user's question is embedded using the same model, producing a 384-dim vector.

3. **Retrieval** Pinecone retrieves the top 5 most semantically relevant chunks using cosine similarity.

4. **Augmentation** Retrieved chunks are formatted into a structured context block and passed to the API alongside the question.

5. **Generation** The API answers using only the provided context: no fabricated prices, verdicts from approved vocabulary only, all costs in ZAR, all answers sourced.

6. **Parsing** The backend parses the API's response and chunk metadata to extract structured `PriceIntelligence`, `KnownFaults`, and `Sources` objects for the frontend panels.

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- An AI API key
- A Pinecone account (free tier) create an index named `cariq-kb`, 384 dimensions, cosine metric

### 1. Clone and configure

```bash
git clone https://github.com/Al-Projects-stack/cariq.git
cd cariq
cp backend/.env.example backend/.env
# Fill in the API keys in backend/.env (see backend/.env.example)
```

### 2. Install and ingest

```bash
cd backend
pip install -r requirements.txt
python scripts/ingest.py
```

### 3. Start the backend

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start the frontend

```bash
cd ../frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

### Docker (full stack)

```bash
docker-compose up --build
```

---

## Knowledge Base

Lives in `backend/knowledge_base/cars/` (20 models). Each JSON file covers price ranges, known faults, inspection checklists, reliability scores, and owner sentiment for a specific SA car model. Run `python scripts/ingest.py` after adding new files. The JSON files are also the seed for the admin-managed database (see below).

---

## Admin Dashboard

A secure area at `/admin` for managing the knowledge base without touching JSON files, plus visibility into failing user questions.

![Admin dashboard screenshot](docs/admin-screenshot.png)
*(Screenshot placeholder: add a capture of the admin overview page here.)*

Features: draft/publish workflow with diffs, version history with rollback, per-fault editing, background Pinecone sync jobs with a health panel, failed-question tracking with resolve actions, audit log, and admin/editor roles.

### Create the first admin

There is no public signup for admins. On the server (or any machine with
`DATABASE_URL` pointing at it):

```bash
cd backend
python scripts/create_admin.py --email you@example.com --role admin
# password is read from an interactive prompt, never from argv
```

Then open `/admin/login`. Editors can edit drafts but cannot publish,
delete, or manage users. Full endpoint reference: `docs/admin-api.md`.

---

## Security

- Input validation via Pydantic schemas
- Prompt injection screening before embedding or generating
- Rate limiting 10 queries per minute per IP
- Security headers on every response
- CORS locked to `FRONTEND_URL` in production
- No secrets committed, environment variables only

---

## Known Limitations

- Knowledge base is manually curated no real-time listings data
- Prices reflect SA market conditions as of early 2025
- Questions about models not yet in the knowledge base will say so
- English only

---

*Built by Al Mujati · 2025-ongoing 

## What I Learnt

- Building a RAG pipeline end to end: chunking a JSON knowledge base, embedding each chunk with fastembed, upserting to Pinecone, and retrieving the top K chunks at query time
- The difference between retrieval failures and generation failures, and how to diagnose which layer is producing a bad answer
- Designing prompts that force the model to answer only from retrieved context and refuse questions outside the knowledge base
- Containerizing a Python + React stack with Docker Compose and managing secrets cleanly across local dev and Render
- **Car comparison feature**: loading two car profiles from JSON, normalising their fields, and rendering a side by side comparison with reliability scores, price tables, fault severity breakdowns, and inspection checklists
- **Market position indicator**: classifying a car into a market segment (budget hatch / family sedan / premium SUV, etc.), computing where its price falls relative to segment peers, and surfacing a value label (UNDERPRICED / FAIR / PREMIUM)
- **3 year total cost of ownership**: learning to estimate real ownership cost (purchase + fuel + insurance + maintenance) and rendering a monthly cost breakdown so buyers can compare beyond sticker price
- **Needs based recommendation quiz**: building a multi step questionnaire that scores each model against the user's budget, body type preference, driving needs, and priorities, then returns a ranked shortlist with reasons
- **TTL caching layer**: building a thread safe in memory cache with LRU eviction, hit/miss stats, and per endpoint TTLs to avoid redundant filesystem reads and Pinecone queries on free tier infra
- **Cookie-session auth with roles**: short lived JWT access cookies plus rotating refresh cookies, double-submit CSRF tokens, brute force lockout with generic errors, and backend-enforced admin/editor roles (the UI only hides buttons, the API enforces)
- **Draft/publish/versioning for knowledge content**: every save writes a full snapshot row, publish flips the live marker only after a successful Pinecone sync, and rollback restores any snapshot as a new draft — plus the lesson that SQLAlchemy keeps deleted rows in already-loaded relationship collections until you expire them
- **Deterministic Pinecone sync**: one shared chunking module for the CLI ingest and the admin publish path, `{slug}_{section}_{index}` vector IDs so republishes overwrite instead of duplicating, upsert-before-delete so a failed publish never leaves a model with zero vectors, and DB-backed background jobs the UI polls
