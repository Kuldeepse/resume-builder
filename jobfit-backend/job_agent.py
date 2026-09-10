import json
import os
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

DEFAULT_TIMEOUT_SECONDS = 25
MAX_RESPONSE_BYTES = 2 * 1024 * 1024


def _safe_timeout() -> int:
    try:
        return max(5, min(60, int(os.getenv("JOB_AGENT_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)))))
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT_SECONDS


def _agent_url() -> str:
    return (os.getenv("JOB_AGENT_URL") or "").strip()


def _validate_agent_url(value: str) -> str:
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname:
        raise RuntimeError("JOB_AGENT_URL must be an HTTPS endpoint.")
    return value


def get_agent_status() -> dict[str, Any]:
    url = _agent_url()
    return {
        "configured": bool(url),
        "provider": "open_source_agent",
        "endpoint_host": urlparse(url).hostname if url else None,
        "timeout_seconds": _safe_timeout(),
    }


def discover_jobs_with_agent(
    *,
    target_role: str,
    location: str,
    candidate_profile: str,
    max_jobs: int = 20,
) -> Optional[dict[str, Any]]:
    """Call an external open-source job agent through CogniTwist's stable HTTP contract.

    The agent may be Hermes or another compatible orchestrator. When JOB_AGENT_URL is
    not configured this function returns None so the caller can keep its existing
    production fallback path.
    """

    url = _validate_agent_url(_agent_url())
    if not url:
        return None

    payload = {
        "task": "discover_score_and_rank_jobs",
        "target_role": target_role,
        "location": location,
        "candidate_profile": candidate_profile,
        "constraints": {
            "max_jobs": max(1, min(40, int(max_jobs))),
            "freshness_days": 14,
            "prefer_direct_employer_url": True,
            "deduplicate": True,
            "never_auto_apply": True,
            "allowed_sources": [
                "employer_career_site",
                "greenhouse",
                "lever",
                "workday",
                "smartrecruiters",
                "ashby",
                "workable",
                "linkedin",
                "indeed",
            ],
        },
        "response_schema": {
            "jobs": [
                {
                    "title": "string",
                    "company": "string",
                    "location": "string",
                    "salary": "string",
                    "posted": "string",
                    "description": "string",
                    "skills": ["string"],
                    "link": "https://...",
                    "match_score": 0,
                    "matched_requirements": ["string"],
                    "missing_requirements": ["string"],
                    "recommendation": "Apply|Apply after tailoring|Review carefully",
                }
            ],
            "best_match_summary": "string",
        },
    }

    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "CogniTwist-Job-Intelligence/1.0",
    }
    token = (os.getenv("JOB_AGENT_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = Request(url, data=body, headers=headers, method="POST")

    try:
        with urlopen(request, timeout=_safe_timeout()) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise RuntimeError("Job agent response exceeded 2 MB.")
    except HTTPError as exc:
        detail = exc.read(1200).decode("utf-8", errors="replace") if exc.fp else ""
        raise RuntimeError(f"Job agent returned HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Job agent is unreachable: {exc.reason}") from exc

    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Job agent returned invalid JSON.") from exc

    if not isinstance(result, dict) or not isinstance(result.get("jobs"), list):
        raise RuntimeError("Job agent response must contain a jobs array.")

    return result
