"""Shared chunking for the knowledge base.

Single source of truth used by both scripts/ingest.py (JSON files) and the
admin publish flow (database snapshots). Chunk TEXT formats are unchanged
from the original ingest script so retrieval behaviour is identical.

Chunk IDs are deterministic ({slug}_{section}_{index}) so republishing a
model overwrites its vectors instead of duplicating them. Section order is
fixed — summary, prices, faults, inspection — and matches
kb_admin.build_chunk_ids().
"""
from app.services.kb_admin import format_repair_range


def chunk_car_dict(car: dict, slug: str) -> list[dict]:
    """
    Chunking strategy:
    - Market summary + owner sentiment = one chunk ({slug}_summary_0)
    - Each price range year band = one chunk ({slug}_price_{i})
    - Each known fault = one chunk ({slug}_fault_{i})
    - What to inspect list = one chunk ({slug}_inspection_0)
    """
    make = car["make"]
    model = car["model"]
    sources_str = ", ".join(car.get("sources", []))
    chunks: list[dict] = []

    # --- Market summary + owner sentiment chunk ---
    summary_text = (
        f"{make} {model}, SA Market Summary\n"
        f"{car.get('sa_market_summary', '')}\n\n"
        f"Reliability score: {car.get('reliability_score', 'N/A')}/10\n"
        f"Years covered: {car.get('years_covered', '')}\n"
        f"Variants: {', '.join(car.get('variants', []))}\n\n"
        f"Owner sentiment: {car.get('owner_sentiment', '')}"
    )
    chunks.append({
        "id": f"{slug}_summary_0",
        "chunk_type": "summary",
        "make": make,
        "model": model,
        "text": summary_text,
        "source": sources_str,
    })

    # --- Price range chunks ---
    for i, pr in enumerate(car.get("price_ranges", [])):
        price_text = (
            f"{make} {model}, Price Range {pr['year_from']}-{pr['year_to']}\n"
            f"Low: R{pr['low_zar']:,} | Mid: R{pr['mid_zar']:,} | High: R{pr['high_zar']:,}\n"
            f"These are typical used car prices for this model in the South African market."
        )
        chunks.append({
            "id": f"{slug}_price_{i}",
            "chunk_type": "price_range",
            "make": make,
            "model": model,
            "year_from": pr["year_from"],
            "year_to": pr["year_to"],
            "low_zar": pr["low_zar"],
            "mid_zar": pr["mid_zar"],
            "high_zar": pr["high_zar"],
            "text": price_text,
            "source": sources_str,
        })

    # --- Known fault chunks ---
    for i, fault in enumerate(car.get("known_faults", [])):
        title = fault.get("fault", fault.get("title", ""))
        repair = fault.get("estimated_repair_zar", "")
        if not repair:
            repair = format_repair_range(fault.get("repair_min_zar"), fault.get("repair_max_zar"))
        fault_text = (
            f"{make} {model}, Known Fault: {title}\n"
            f"Affects variants: {', '.join(fault.get('affects_variants', []))}\n"
            f"Mileage range: {fault.get('mileage_range', '')}\n"
            f"Severity: {fault.get('severity', '')}\n"
            f"Description: {fault.get('description', '')}\n"
            f"What to inspect: {fault.get('what_to_inspect', '')}\n"
            f"Estimated repair cost (ZAR): {repair}\n"
            f"Source: {fault.get('source', sources_str)}"
        )
        chunks.append({
            "id": f"{slug}_fault_{i}",
            "chunk_type": "fault",
            "make": make,
            "model": model,
            "fault_name": title,
            "mileage_range": fault.get("mileage_range", ""),
            "severity": fault.get("severity", ""),
            "estimated_repair_zar": repair,
            "text": fault_text,
            "source": fault.get("source", sources_str),
        })

    # --- What to inspect chunk ---
    inspect_items = car.get("what_to_inspect_before_buying", car.get("checklist", []))
    items = [it["text"] if isinstance(it, dict) else it for it in inspect_items]
    if items:
        inspect_text = (
            f"{make} {model} ,  What to Inspect Before Buying\n"
            + "\n".join(f"- {item}" for item in items)
        )
        chunks.append({
            "id": f"{slug}_inspection_0",
            "chunk_type": "inspection",
            "make": make,
            "model": model,
            "text": inspect_text,
            "source": sources_str,
        })

    return chunks
