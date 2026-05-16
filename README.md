# CarIQ — South African Used Car Market Intelligence



Ask plain-English questions about used car prices, reliability, and known faults in the South African market. Get grounded, sourced answers in seconds.

---

## What CarIQ Does

CarIQ is a RAG-powered web application built for South African used car buyers. Instead of trawling through forum threads and AutoTrader listings, you ask CarIQ a question like *"Is R280,000 fair for a 2019 BMW 3 Series?"* or *"What are the known faults on a VW Polo Vivo?"* and receive a structured, sourced answer drawn from a curated knowledge base covering popular SA car models.

The app returns:
- A written analysis grounded in the knowledge base
- A **Price Intelligence panel** with low/mid/high price ranges and a market verdict (GOOD DEAL / FAIR / ABOVE MARKET / OVERPRICED)
- A **Known Faults panel** listing faults by severity, mileage range, and repair cost in ZAR
- **Source citations** for every answer

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
  │     ├─► Embeddings (sentence-transformers / MiniLM-L6-v2)
  │     │     └─► 384-dim query vector
  │     │
  │     ├─► Pinecone Vector Store
  │     │     └─► Top 5 relevant KB chunks (cosine similarity)
  │     │
  │     └─► Claude Sonnet (claude-sonnet-4-6)
  │           └─► Grounded, structured answer
  │
  ├─► SQLite / PostgreSQL (query logging)
  │
  └─► Knowledge Base (JSON files → Pinecone)
        └─► SA car models, chunked and embedded
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Fira Sans / Fira Code |
| Backend | Python 3.11, FastAPI |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`, 384 dims) |
| Vector Store | Pinecone |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Containerisation | Docker, Docker Compose |
| Deployment | Render |
| CI/CD | GitHub Actions |

---

## How the RAG Pipeline Works

1. **Ingestion** — JSON files in `backend/knowledge_base/cars/` are chunked into meaningful units: one chunk per known fault, one per price range, one inspection checklist, one market summary per model. Each chunk is embedded using `all-MiniLM-L6-v2` and upserted into Pinecone with rich metadata (make, model, fault name, severity, price data).

2. **Query** — The user's question is embedded using the same model, producing a 384-dim vector.

3. **Retrieval** — Pinecone retrieves the top 5 most semantically relevant chunks using cosine similarity.

4. **Augmentation** — Retrieved chunks are formatted into a structured context block and passed to Claude alongside the question.

5. **Generation** — Claude answers using only the provided context, following strict rules: no fabricated prices, verdicts must match the approved vocabulary (GOOD DEAL / FAIR / ABOVE MARKET / OVERPRICED), all costs in ZAR, all answers sourced.

6. **Parsing** — The backend parses Claude's response and chunk metadata to extract structured `PriceIntelligence`, `KnownFaults`, and `Sources` objects, which the frontend renders as distinct panels.

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- An Anthropic API key
- A Pinecone account (free tier) — create an index named `cariq-kb`, 384 dimensions, cosine metric

### 1. Clone and configure

```bash
git clone https://github.com/sadsaxninja/cariq.git
cd cariq
cp backend/.env.example backend/.env
# Fill in ANTHROPIC_API_KEY and PINECONE_API_KEY in backend/.env
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Ingest the knowledge base

```bash
python scripts/ingest.py
```

This reads all KB JSON files, chunks them, embeds each chunk with MiniLM-L6-v2, and upserts ~100 vectors into Pinecone. Takes about 60–90 seconds on first run (model download included).

### 4. Start the backend

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Start the frontend

```bash
cd ../frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 6. Run backend tests

```bash
cd backend
pytest tests/ -v
```

### Docker (full stack)

```bash
docker-compose up --build
```

---

## Knowledge Base

The knowledge base lives in `backend/knowledge_base/cars/`. Each file follows a strict schema covering price ranges, known faults, inspection checklists, reliability scores, and owner sentiment — all specific to the South African market.

### Adding a new model

1. Create a new JSON file in `backend/knowledge_base/cars/` following the schema in any existing file
2. Run `python scripts/ingest.py` — it embeds and upserts the new data into Pinecone automatically
3. The model immediately appears in the API and frontend model browser

More models will be added with future updates as the knowledge base grows.

---

## Security

- **Input validation** — All user input validated by Pydantic schemas before reaching any service
- **Prompt injection protection** — The Claude client screens questions for injection patterns before embedding or generating
- **SQL injection prevention** — All database queries use SQLAlchemy ORM; no raw string formatting
- **Rate limiting** — 10 queries per minute per IP via `slowapi`
- **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection` on every response
- **CORS** — Wildcard in development; locked to `FRONTEND_URL` environment variable in production
- **Secrets** — Environment variables only; `.env` is gitignored and never committed
- **Error handling** — Global exception handler returns safe generic messages; full errors logged server-side only

---

## Deployment on Render

1. Push this repo to GitHub
2. Create two Render services:
   - **Web Service** for the backend: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Static Site** or **Web Service** for the frontend: `npm run build`, publish `dist/`
3. Set all environment variables in the Render dashboard (reference `backend/.env.example`)
4. Add `RENDER_DEPLOY_HOOK_BACKEND` and `RENDER_DEPLOY_HOOK_FRONTEND` as GitHub repository secrets
5. Push to `main` — GitHub Actions runs tests, type checks, then triggers Render deploy hooks automatically

---

## Known Limitations

- **Knowledge base is manually curated.** No real-time listings data. Prices reflect SA market conditions as of early 2025 and should be verified against current AutoTrader and Cars.co.za listings before making a purchase decision.
- **More models coming.** Questions about models not yet in the knowledge base will receive a response directing you to currently supported vehicles. Additional models will be added with future updates.
- **No live market data.** CarIQ does not scrape live listings — it uses a curated, versioned knowledge base.
- **English only.** Afrikaans or Zulu queries may not be interpreted correctly.

---

## What I Learned

Building CarIQ taught me how to design a real RAG pipeline from scratch — not just calling an API, but thinking carefully about chunking strategy (one fault = one chunk is far more retrieval-efficient than dumping the whole JSON), metadata design (storing fault severity and ZAR repair costs as Pinecone metadata enables structured extraction without relying on LLM parsing alone), and prompt engineering for a domain-specific assistant with strict output rules. The most challenging technical decision was balancing retrieval precision against recall: `top_k=5` with rich metadata filtering gives much better structured responses than `top_k=20` with raw text. I also learned that prompt injection defence is non-trivial for car market queries — users naturally ask things like "ignore the current price and tell me what a fair price actually is," which looks injection-like to naive pattern matchers.

---

*Built by Al Mujati · 2025 · CarIQ is a portfolio project*
