from __future__ import annotations

import asyncio
import math
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

API_ROOT = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
LONDON = ZoneInfo("Europe/London")
app = FastAPI(title="Wind Forecast Accuracy API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def pick(row: dict[str, Any], *keys: str) -> Any:
    lowered = {str(k).lower(): v for k, v in row.items()}
    for key in keys:
        if key.lower() in lowered:
            return lowered[key.lower()]
    return None


def records_from(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    if isinstance(payload, dict):
        for key in ("data", "result", "results", "records"):
            value = payload.get(key)
            if isinstance(value, list):
                return [r for r in value if isinstance(r, dict)]
    return []


async def fetch_dataset(client: httpx.AsyncClient, code: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
    params = {
        "publishDateTimeFrom": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "publishDateTimeTo": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "format": "json",
    }
    response = await client.get(f"{API_ROOT}/{code}/stream", params=params)
    if response.status_code == 429:
        raise HTTPException(status_code=503, detail="Elexon rate limit reached. Please try again shortly.")
    response.raise_for_status()
    try:
        return records_from(response.json())
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"Elexon returned an unreadable {code} response.") from exc


def normalise_actuals(rows: list[dict[str, Any]], start_utc: datetime, end_utc: datetime) -> dict[datetime, float]:
    values: dict[datetime, float] = {}
    for row in rows:
        fuel = pick(row, "fuelType", "fueltype")
        if str(fuel).upper() != "WIND":
            continue
        stamp = parse_time(pick(row, "startTime", "starttime"))
        raw = pick(row, "generation")
        if stamp is None or not (start_utc <= stamp < end_utc) or raw is None:
            continue
        try:
            values[stamp] = float(raw)
        except (ValueError, TypeError):
            continue
    return values


def analyse(actual_rows: list[dict[str, Any]], forecast_rows: list[dict[str, Any]], start: date, end: date, cutoff_hours: int) -> dict[str, Any]:
    start_local = datetime.combine(start, time.min, LONDON)
    end_local = datetime.combine(end + timedelta(days=1), time.min, LONDON)
    start_utc, end_utc = start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
    actuals = normalise_actuals(actual_rows, start_utc, end_utc)
    forecasts: dict[datetime, list[tuple[datetime, float]]] = {}
    for row in forecast_rows:
        target = parse_time(pick(row, "startTime", "starttime"))
        published = parse_time(pick(row, "publishTime", "publishtime"))
        raw = pick(row, "generation")
        if target is None or published is None or raw is None or not (start_utc <= target < end_utc):
            continue
        try:
            forecast_value = float(raw)
        except (ValueError, TypeError):
            continue
        eligible_at = target - timedelta(hours=cutoff_hours)
        if published <= eligible_at:
            forecasts.setdefault(target, []).append((published, forecast_value))

    rows = []
    for target in sorted(set(actuals) | set(forecasts)):
        candidates = forecasts.get(target, [])
        selected = max(candidates, key=lambda x: x[0]) if candidates else None
        actual = actuals.get(target)
        forecast = selected[1] if selected else None
        error = forecast - actual if forecast is not None and actual is not None else None
        rows.append({
            "startTime": target.isoformat(),
            "publishTime": selected[0].isoformat() if selected else None,
            "forecast": forecast,
            "actual": actual,
            "error": error,
            "absoluteError": abs(error) if error is not None else None,
        })
    matched = [r for r in rows if r["error"] is not None]
    errors = [r["error"] for r in matched]
    count = len(errors)
    return {
        "meta": {
            "startDate": start.isoformat(), "endDate": end.isoformat(),
            "cutoffHours": cutoff_hours, "timezone": "Europe/London",
            "unit": "MW", "actualRecords": len(actuals),
            "forecastIntervals": len(forecasts), "matchedIntervals": count,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "sources": ["Elexon FUELHH (WIND)", "Elexon WINDFOR"],
        },
        "metrics": {
            "mae": sum(abs(e) for e in errors) / count if count else None,
            "rmse": math.sqrt(sum(e * e for e in errors) / count) if count else None,
            "bias": sum(errors) / count if count else None,
            "matchedIntervals": count,
        },
        "rows": rows,
    }


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard")
async def dashboard(
    start_date: date = Query(default=date(2026, 1, 1)),
    end_date: date = Query(default=date(2026, 1, 31)),
    cutoff_hours: int = Query(default=12, ge=1, le=47),
) -> dict[str, Any]:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date.")
    if (end_date - start_date).days > 30:
        raise HTTPException(status_code=400, detail="Choose a date range of 31 days or less.")
    start_local = datetime.combine(start_date, time.min, LONDON)
    end_local = datetime.combine(end_date + timedelta(days=1), time.min, LONDON)
    query_start = (start_local - timedelta(days=2)).astimezone(timezone.utc)
    query_end = (end_local + timedelta(days=1)).astimezone(timezone.utc)
    timeout = httpx.Timeout(45.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, headers={"Accept": "application/json"}) as client:
            actual_rows, forecast_rows = await asyncio.gather(
                fetch_dataset(client, "FUELHH", query_start, query_end),
                fetch_dataset(client, "WINDFOR", query_start, query_end),
            )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Elexon API returned HTTP {exc.response.status_code}.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Elexon took too long to respond. Try again shortly.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Could not connect to the Elexon API.") from exc
    return analyse(actual_rows, forecast_rows, start_date, end_date, cutoff_hours)
