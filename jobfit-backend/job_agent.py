import json
import os
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from google import genai
from google.genai import types

DEFAULT_TIMEOUT_SECONDS = 25
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
LOCAL_FALLBACK_MODEL = "gemini-2.5-flash"


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


def _clean_json_text(value: str) -> str:
    text = (value or "").strip()
    if "```json" in text:
        text = text.split("```json")[-1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[-1].split("```")[0].strip()
    return text


def _discover_with_local_grounded_search(
    *,
    target_role: str,
    location: str,
    candidate_profile: str,
    max_jobs: int,
) -> Optional[dict[str, Any]]:
    """Fast built-in recovery provider used until an external OSS agent is configured.

    It intentionally performs discovery + fit scoring in one grounded Gemini call so
    CogniTwist does not fall through to the older two-call job-search flow.
    """

    if (os.getenv("JOB_AGENT_LOCAL_FALLBACK", "true").strip().lower() in {"0", "false", "no"}):
        return None

    client = genai.Client()
    requested_jobs = max(1, min(10, int(max_jobs)))
    profile = candidate_profile[:12000]

    prompt = f"""You are CogniTwist Job Intelligence.
Use Google Search to find current real vacancies for the target role and location below.
Prefer direct employer/ATS pages and recent vacancies. Never invent a vacancy or URL.
Return ONLY valid JSON. No markdown and no commentary.

TARGET ROLE: {target_role}
LOCATION: {location}
MAX JOBS: {requested_jobs}

CANDIDATE PROFILE:
{profile}

Return this exact JSON shape:
{{
  "jobs": [
    {{
      "title": "string",
      "company": "string",
      "location": "string",
      "salary": "string or Not disclosed",
      "posted": "string",
      "description": "concise role summary",
      "skills": ["string"],
      "link": "https://exact-job-url",
      "match_score": 0,
      "matched_requirements": ["evidence-backed match"],
      "missing_requirements": ["important gap"],
      "recommendation": "Apply"
    }}
  ],
  "best_match_summary": "short summary"
}}

Rules:
- recommendation must be exactly one of: Apply, Apply after tailoring, Review carefully;
- match_score must be an integer 0-100;
- score only against evidence in the candidate profile;
- do not count unsupported experience as a match;
- return at most {requested_jobs} jobs;
- return only jobs supported by the search results;
- use exact HTTPS application/job URLs where available.
"""

    try:
        response = client.models.generate_content(
            model=os.getenv("JOB_AGENT_LOCAL_MODEL", LOCAL_FALLBACK_MODEL),
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.0,
            ),
        )
        result = json.loads(_clean_json_text(response.text or ""))
    except Exception:
        return None

    if not isinstance(result, dict) or not isinstance(result.get("jobs"), list):
        return None

    result["jobs"] = result["jobs"][:requested_jobs]
    result["provider"] = "local_grounded_search"
    return result


def get_agent_status() -> dict[str, Any]:
    url = _agent_url()
    local_enabled = os.getenv("JOB_AGENT_LOCAL_FALLBACK", "true").strip().lower() not in {"0", "false", "no"}
    return {
        "configured": bool(url),
        "provider": "open_source_agent" if url else "local_grounded_search",
        "endpoint_host": urlparse(url).hostname if url else None,
        "timeout_seconds": _safe_timeout(),
        "local_fallback_enabled": local_enabled,
        "local_fallback_model": os.getenv("JOB_AGENT_LOCAL_MODEL", LOCAL_FALLBACK_MODEL) if local_enabled else None,
    }


def discover_jobs_with_agent(
    *,
    target_role: str,
    location: str,
    candidate_profile: str,
    max_jobs: int = 20,
) -> Optional[dict[str, Any]]:
    """Discover jobs through an external OSS agent or the fast built-in recovery provider.

    If JOB_AGENT_URL is configured, Hermes or another compatible agent is used first.
    Otherwise CogniTwist uses one grounded Gemini call to avoid the slower legacy
    two-step search path while the persistent job index is being built.
    """

    url = _validate_agent_url(_agent_url())
    if not url:
        return _discover_with_local_grounded_search(
            target_role=target_role,
            location=location,
            candidate_profile=candidate_profile,
            max_jobs=max_jobs,
        )

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
