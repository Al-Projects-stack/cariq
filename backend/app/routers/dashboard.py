from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header, Response
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from app.config import settings
from app.db.database import get_db
from app.db.models import ClaudeCallLog, ClaudeDeadLetter

router = APIRouter(tags=["dashboard"])

_WINDOWS = {
    "today": lambda now: now.replace(hour=0, minute=0, second=0, microsecond=0),
    "7d": lambda now: now - timedelta(days=7),
    "30d": lambda now: now - timedelta(days=30),
}


def _require_dashboard_token(x_dashboard_token: str = Header(default="")) -> None:
    if settings.environment != "development":
        if not settings.dashboard_token or settings.dashboard_token == "change-me":
            raise HTTPException(500, detail="DASHBOARD_TOKEN not configured")
        if x_dashboard_token != settings.dashboard_token:
            raise HTTPException(401, detail="Invalid dashboard token")
    elif x_dashboard_token != settings.dashboard_token:
        raise HTTPException(401, detail="Invalid dashboard token")


def _window_since(window: str) -> datetime:
    if window not in _WINDOWS:
        raise HTTPException(422, detail="window must be today, 7d, or 30d")
    return _WINDOWS[window](datetime.utcnow())


@router.get("/dashboard/stats")
def dashboard_stats(
    window: str = "7d",
    _: None = Depends(_require_dashboard_token),
    db: Session = Depends(get_db),
):
    since = _window_since(window)

    logs = db.query(ClaudeCallLog).filter(ClaudeCallLog.created_at >= since).all()
    if not logs:
        return {
            "window": window,
            "total_calls": 0,
            "total_cost_usd": 0.0,
            "success_rate": 0.0,
            "failure_rate": 0.0,
            "avg_latency_ms": 0,
            "per_feature": [],
        }

    total_calls = len(logs)
    total_cost = round(sum(l.cost_usd or 0 for l in logs), 4)
    failures = sum(1 for l in logs if l.status == "failed")
    success_rate = round((total_calls - failures) / total_calls * 100, 1)
    avg_latency = round(sum(l.latency_ms or 0 for l in logs) / total_calls)

    by_feature: dict[str, dict] = {}
    for l in logs:
        f = by_feature.setdefault(l.feature, {"calls": 0, "latency": 0, "cost": 0.0, "failures": 0})
        f["calls"] += 1
        f["latency"] += l.latency_ms or 0
        f["cost"] += l.cost_usd or 0
        if l.status == "failed":
            f["failures"] += 1

    per_feature = [
        {
            "feature": name,
            "calls": d["calls"],
            "avg_latency_ms": round(d["latency"] / d["calls"]),
            "cost_usd": round(d["cost"], 4),
            "failures": d["failures"],
        }
        for name, d in sorted(by_feature.items())
    ]

    return {
        "window": window,
        "total_calls": total_calls,
        "total_cost_usd": total_cost,
        "success_rate": success_rate,
        "failure_rate": round(100 - success_rate, 1),
        "avg_latency_ms": avg_latency,
        "per_feature": per_feature,
    }


@router.get("/dashboard/dead-letters")
def dashboard_dead_letters(
    _: None = Depends(_require_dashboard_token),
    db: Session = Depends(get_db),
):
    entries = db.query(ClaudeDeadLetter).order_by(ClaudeDeadLetter.created_at.desc()).limit(100).all()
    return {
        "total": len(entries),
        "items": [
            {
                "id": e.id,
                "call_id": e.call_id,
                "feature": e.feature,
                "error_type": e.error_type,
                "error_message": e.error_message,
                "attempts": e.attempts,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
    }


DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CarIQ Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
  h1 { font-size: 22px; margin-bottom: 16px; }
  .controls { display: flex; gap: 8px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
  .controls input, .controls select, .controls button { padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; font-size: 14px; }
  .controls button { background: #2563eb; border: none; cursor: pointer; }
  .controls button:hover { background: #1d4ed8; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px; }
  .card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; }
  .card .value { font-size: 24px; font-weight: 600; margin-top: 6px; }
  .card .value.green { color: #4ade80; } .card .value.red { color: #f87171; } .card .value.blue { color: #60a5fa; }
  h2 { font-size: 16px; margin: 20px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; background: #1e293b; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #334155; }
  th { background: #0b1220; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .error { color: #f87171; font-size: 14px; margin-top: 8px; }
  .badge { padding: 3px 8px; border-radius: 999px; font-size: 12px; }
  .badge.success { background: #14532d; color: #4ade80; } .badge.fail { background: #7f1d1d; color: #f87171; }
</style>
</head>
<body>
<h1>CarIQ API Dashboard</h1>
<div class="controls">
  <input type="password" id="token" placeholder="Dashboard token" style="width: 200px;">
  <select id="window">
    <option value="today">Today</option>
    <option value="7d" selected>Last 7 days</option>
    <option value="30d">Last 30 days</option>
  </select>
  <button onclick="loadStats()">Refresh stats</button>
  <button onclick="loadDeadLetters()">Refresh dead letters</button>
</div>

<h2>Cost &amp; performance</h2>
<div class="cards">
  <div class="card"><div class="label">Total cost (window)</div><div class="value blue" id="cost">-</div></div>
  <div class="card"><div class="label">Calls (window)</div><div class="value" id="calls">-</div></div>
  <div class="card"><div class="label">Avg latency</div><div class="value" id="latency">-</div></div>
  <div class="card"><div class="label">Success rate</div><div class="value green" id="success">-</div></div>
</div>

<h2>Per feature</h2>
<table id="featureTable"><thead><tr><th>Feature</th><th>Calls</th><th>Avg latency</th><th>Cost</th><th>Failures</th></tr></thead><tbody></tbody></table>

<h2>Dead-lettered requests</h2>
<table id="deadTable"><thead><tr><th>Time</th><th>Feature</th><th>Error</th><th>Attempts</th></tr></thead><tbody></tbody></table>
<div class="error" id="errorMsg"></div>

<script>
const API = '';
async function fetchJson(path) {
  const token = document.getElementById('token').value;
  const res = await fetch(API + path, { headers: { 'X-Dashboard-Token': token } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body.detail || res.statusText));
  }
  return res.json();
}
function fmtUsd(v) { return '$' + (v || 0).toFixed(4); }
async function loadStats() {
  const win = document.getElementById('window').value;
  try {
    const d = await fetchJson('/api/v1/dashboard/stats?window=' + win);
    document.getElementById('cost').textContent = fmtUsd(d.total_cost_usd);
    document.getElementById('calls').textContent = d.total_calls;
    document.getElementById('latency').textContent = d.avg_latency_ms + ' ms';
    document.getElementById('success').textContent = d.success_rate + '%';
    const tbody = document.querySelector('#featureTable tbody');
    tbody.innerHTML = d.per_feature.map(f => `<tr>
      <td>${f.feature}</td><td>${f.calls}</td>
      <td>${f.avg_latency_ms} ms</td><td>${fmtUsd(f.cost_usd)}</td>
      <td>${f.failures ? '<span class="badge fail">' + f.failures + '</span>' : f.failures}</td></tr>`).join('')
      || '<tr><td colspan="5">No calls in this window</td></tr>';
    document.getElementById('errorMsg').textContent = '';
  } catch (e) { document.getElementById('errorMsg').textContent = e.message; }
}
async function loadDeadLetters() {
  try {
    const d = await fetchJson('/api/v1/dashboard/dead-letters');
    const tbody = document.querySelector('#deadTable tbody');
    tbody.innerHTML = d.items.map(x => `<tr>
      <td>${new Date(x.created_at).toLocaleString()}</td>
      <td>${x.feature}</td>
      <td>${x.error_type}: ${x.error_message}</td>
      <td>${x.attempts}</td></tr>`).join('')
      || '<tr><td colspan="4">No dead-lettered requests</td></tr>';
    document.getElementById('errorMsg').textContent = '';
  } catch (e) { document.getElementById('errorMsg').textContent = e.message; }
}
loadStats();
</script>
</body>
</html>"""


@router.get("/dashboard")
def dashboard_page(response: Response):
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return DASHBOARD_HTML
