import os
from urllib.parse import urlparse

from fastapi import Request
from fastapi.responses import JSONResponse

from career_network import router as career_network_router
from main import app

_DEFAULT_ALLOWED_ORIGINS = {
    "https://rolecraftai.duckdns.org",
    "https://resume-builder-ha5ykxvh9-resume-builder-s-projects.vercel.app",
}

_configured_origins = {
    origin.strip().rstrip("/")
    for origin in os.getenv("CAREER_NETWORK_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}
_ALLOWED_ORIGINS = _DEFAULT_ALLOWED_ORIGINS | _configured_origins


def _is_allowed_origin(origin: str) -> bool:
    normalised = origin.rstrip("/")
    if normalised in _ALLOWED_ORIGINS:
        return True

    try:
        host = urlparse(normalised).hostname or ""
    except ValueError:
        return False

    # Permit RoleCraft preview deployments without opening access to arbitrary domains.
    return host.endswith("-resume-builder-s-projects.vercel.app") and host.startswith("resume-builder-")


@app.middleware("http")
async def protect_career_network_routes(request: Request, call_next):
    if request.url.path.startswith("/career-network"):
        origin = request.headers.get("origin")
        if origin and not _is_allowed_origin(origin):
            return JSONResponse(status_code=403, content={"detail": "Origin is not allowed."})

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/career-network") else response.headers.get("Cache-Control", "")
    return response


app.include_router(career_network_router)
