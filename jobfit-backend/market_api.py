from typing import Any

from fastapi import Form, HTTPException

from main import app, safe_text
from market_discovery import discover_market_jobs


@app.post("/discover-market-jobs/")
@app.post("/discover-market-jobs")
async def discover_market_jobs_endpoint(
    target_role: str = Form(...),
    location_city: str = Form(""),
    freshness_days: int = Form(14),
    max_jobs: int = Form(100),
) -> dict[str, Any]:
    role = safe_text(target_role, 300)
    location = safe_text(location_city, 200)
    if not role:
        raise HTTPException(status_code=400, detail="Enter a target role, skill or company.")

    try:
        return discover_market_jobs(
            target_role=role,
            location=location,
            freshness_days=max(1, min(90, int(freshness_days or 14))),
            max_jobs=max(1, min(120, int(max_jobs or 100))),
        )
    except Exception as exc:
        # Do not expose provider/model internals to callers.
        raise HTTPException(
            status_code=502,
            detail="Expanded market discovery is temporarily unavailable.",
        ) from exc
