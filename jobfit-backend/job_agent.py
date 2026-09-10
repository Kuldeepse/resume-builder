import ipaddress
import json
import os
import socket
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

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


def _allowed_agent_hosts() -> set[str]:
    return {
        host.strip().lower().rstrip(".")
        for host in (os.getenv("JOB_AGENT_ALLOWED_HOSTS") or "").split(",")
        if host.strip()
    }


def _host_is_allowed_by_policy(hostname: str) -> bool:
    allowed_hosts = _allowed_agent_hosts()
    if not allowed_hosts:
        return True
    return any(hostname == host or hostname.endswith(f".{host}") for host in allowed_hosts)


def _assert_public_host(hostname: str, port: int) -> None:
    try:
        literal_ip = ipaddress.ip_address(hostname)
        if not literal_ip.is_global:
            raise RuntimeError("JOB_AGENT_URL must not target a private or non-public address.")
        return
    except ValueError:
        pass

    try:
        resolved = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise RuntimeError("JOB_AGENT_URL hostname could not be resolved safely.") from exc

    addresses = {item[4][0] for item in resolved if item and item[4]}
    if not addresses:
        raise RuntimeError("JOB_AGENT_URL hostname did not resolve to a public address.")

    for address in addresses:
        try:
            resolved_ip = ipaddress.ip_address(address)
        except ValueError as exc:
            raise RuntimeError("JOB_AGENT_URL resolved to an invalid network address.") from exc
        if not resolved_ip.is_global:
            raise RuntimeError("JOB_AGENT_URL must not resolve to a private or non-public address.")


def _validate_agent_url(value: str) -> str:
    if not value:
        return ""

    try:
        parsed = urlparse(value)
    except ValueError as exc:
        raise RuntimeError("JOB_AGENT_URL is invalid.") from exc

    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise RuntimeError("JOB_AGENT_URL must be an HTTPS endpoint.")
    if parsed.username or parsed.password:
        raise RuntimeError("JOB_AGENT_URL must not contain embedded credentials.")

    hostname = parsed.hostname.lower().rstrip(".")
    if not _host_is_allowed_by_policy(hostname):
        raise RuntimeError("JOB_AGENT_URL host is not in JOB_AGENT_ALLOWED_HOSTS.")

    _assert_public_host(hostname, parsed.port or 443)
    return value


class _SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_agent_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


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
        "authenticated": bool((os.getenv("JOB_AGENT_TOKEN") or "").strip()) if url else None,
        "host_allowlist_configured": bool(_allowed_agent_hosts()) if url else None,
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

    If JOB_AGENT_URL is configured, an authenticated HTTPS agent is used first.
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

    token = (os.getenv("JOB_AGENT_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("External job agent is disabled until JOB_AGENT_TOKEN is configured.")

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
        "Authorization": f"Bearer {token}",
    }

    request = Request(url, data=body, headers=headers, method="POST")
    opener = build_opener(_SafeRedirectHandler())

    try:
        with opener.open(request, timeout=_safe_timeout()) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise RuntimeError("Job agent response exceeded the permitted response size.")
    except HTTPError as exc:
        raise RuntimeError(f"Job agent returned HTTP {exc.code}.") from exc
    except URLError as exc:
        raise RuntimeError("Job agent is unreachable.") from exc

    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Job agent returned invalid JSON.") from exc

    if not isinstance(result, dict) or not isinstance(result.get("jobs"), list):
        raise RuntimeError("Job agent response must contain a jobs array.")

    return result
