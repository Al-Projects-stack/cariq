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

---

## Architecture

\`\`\`
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
  │     └─► Claude Sonnet (claude-sonnet-4-6)
  │           └─► Grounded, structured answer
  │
  ├─► PostgreSQL (query logging)
  │
  └─► Knowledge Base (JSON files → Pinecone)
        └─► SA car models, chunked and embedded
\`\`\`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI |
| AI | Anthropic Claude API (\`claude-sonnet-4-6\`) |
| Embeddings | fastembed (\`BAAI/bge-small-en-v1.5\`, 384 dims) |
| Vector Store | Pinecone |
| Database | PostgreSQL |
| Containerisation | Docker, Docker Compose |
| Deployment | Render |

---

## How the RAG Pipeline Works

1. **Ingestion** JSON files in \`backend/knowledge_base/cars/\` are chunked into meaningful units: one chunk per known fault, one per price range, one inspection checklist, one market summary per model. Each chunk is embedded using \`BAAI/bge-small-en-v1.5\` and upserted into Pinecone with rich metadata.

2. **Query** The user's question is embedded using the same model, producing a 384-dim vector.

3. **Retrieval** Pinecone retrieves the top 5 most semantically relevant chunks using cosine similarity.

4. **Augmentation** Retrieved chunks are formatted into a structured context block and passed to Claude alongside the question.

5. **Generation** Claude answers using only the provided context: no fabricated prices, verdicts from approved vocabulary only, all costs in ZAR, all answers sourced.

6. **Parsing** The backend parses Claude's response and chunk metadata to extract structured \`PriceIntelligence\`, \`KnownFaults\`, and \`Sources\` objects for the frontend panels.

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- An Anthropic API key
- A Pinecone account (free tier) create an index named \`cariq-kb\`, 384 dimensions, cosine metric

### 1. Clone and configure

\`\`\`bash
git clone https://github.com/Al-Projects-stack/cariq.git
cd cariq
cp backend/.env.example backend/.env
# Fill in ANTHROPIC_API_KEY and PINECONE_API_KEY in backend/.env
\`\`\`

### 2. Install and ingest

\`\`\`bash
cd backend
pip install -r requirements.txt
python scripts/ingest.py
\`\`\`

### 3. Start the backend

\`\`\`bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

### 4. Start the frontend

\`\`\`bash
cd ../frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
\`\`\`

### Docker (full stack)

\`\`\`bash
docker-compose up --build
\`\`\`

---

## Knowledge Base

Lives in \`backend/knowledge_base/cars/\`. Each JSON file covers price ranges, known faults, inspection checklists, reliability scores, and owner sentiment for a specific SA car model. Run \`python scripts/ingest.py\` after adding new files.

---

## Security

- Input validation via Pydantic schemas
- Prompt injection screening before embedding or generating
- Rate limiting 10 queries per minute per IP
- Security headers on every response
- CORS locked to \`FRONTEND_URL\` in production
- No secrets committed environment variables only

---

## Known Limitations

- Knowledge base is manually curated no real-time listings data
- Prices reflect SA market conditions as of early 2025
- Questions about models not yet in the knowledge base will say so
- English only

---

*Built by Al Mujati · 2025-ongoing 

## What I Learned

- Building a RAG pipeline end to end: chunking a JSON knowledge base, embedding each chunk with fastembed, upserting to Pinecone, and retrieving the top K chunks at query time
- The difference between retrieval failures and generation failures, and how to diagnose which layer is producing a bad answer
- Designing prompts that force the model to answer only from retrieved context and refuse questions outside the knowledge base
- Containerizing a Python + React stack with Docker Compose and managing secrets cleanly across local dev and Render
