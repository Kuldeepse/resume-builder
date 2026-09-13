import ipaddress
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

from google import genai

DEFAULT_MODEL = "gemini-2.5-flash"
MAX_PASS_JOBS = 30
MAX_TOTAL_JOBS = 120


def _clean(value: Any, limit: int = 3000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _safe_https_job_url(value: Any) -> str | None:
    candidate = _clean(value, 2000)
    if not candidate:
        return None
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or not parsed.hostname or parsed.username or parsed.password:
        return None
    hostname = parsed.hostname.lower().rstrip(".")
    try:
        ipaddress.ip_address(hostname)
        return None
    except ValueError:
        pass
    if hostname in {"localhost", "local"} or hostname.endswith((".local", ".internal", ".localhost")):
        return None
    return candidate


def _job_key(job: dict[str, Any]) -> str:
    def norm(value: Any) -> str:
        return re.sub(r"[^a-z0-9]+", " ", _clean(value, 300).lower()).strip()

    link = _safe_https_job_url(job.get("link")) or ""
    if link:
        parsed = urlparse(link)
        path = re.sub(r"[?#].*$", "", parsed.path.rstrip("/").lower())
        return f"url::{parsed.hostname or ''}{path}"
    return f"job::{norm(job.get('company'))}::{norm(job.get('title'))}::{norm(job.get('location'))}"


def _role_variants(value: str) -> list[str]:
    base = _clean(value, 300)
    if not base:
        return []
    variants = [base]

    def add(candidate: str) -> None:
        cleaned = _clean(candidate, 300)
        if cleaned and all(item.lower() != cleaned.lower() for item in variants):
            variants.append(cleaned)

    replacements = [
        (r"\bprogramme\b", "program"),
        (r"\bprogram\b", "programme"),
        (r"\bproject\b", "program"),
        (r"\bproject\b", "programme"),
        (r"\btechnical programme manager\b", "technical project manager"),
        (r"\btechnical program manager\b", "technical project manager"),
        (r"\btechnical project manager\b", "technical program manager"),
        (r"\bdelivery manager\b", "technical delivery manager"),
    ]
    for pattern, replacement in replacements:
        if re.search(pattern, base, flags=re.I):
            add(re.sub(pattern, replacement, base, flags=re.I))

    if re.fullmatch(r"tpm", base, flags=re.I):
        add("Technical Program Manager")
        add("Technical Programme Manager")
        add("Technical Project Manager")

    return variants[:4]


def _schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "jobs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "company": {"type": "string"},
                        "location": {"type": "string"},
                        "salary": {"type": "string"},
                        "posted": {"type": "string"},
                        "description": {"type": "string"},
                        "skills": {"type": "array", "items": {"type": "string"}},
                        "link": {"type": "string"},
                        "source_type": {"type": "string"},
                    },
                    "required": [
                        "title",
                        "company",
                        "location",
                        "salary",
                        "posted",
                        "description",
                        "skills",
                        "link",
                        "source_type",
                    ],
                },
            }
        },
        "required": ["jobs"],
    }


def _parse_json_text(value: str) -> dict[str, Any]:
    text = (value or "").strip()
    if "```json" in text:
        text = text.split("```json")[-1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[-1].split("```")[0].strip()
    parsed = json.loads(text)
    return parsed if isinstance(parsed, dict) else {"jobs": []}


def _query_passes(target_role: str, location: str, freshness_days: int) -> tuple[list[str], list[tuple[str, str]]]:
    variants = _role_variants(target_role)
    place = _clean(location, 200)
    days = max(1, min(90, int(freshness_days)))
    family = " OR ".join(f'\"{item}\"' for item in variants)

    return variants, [
        (
            "broad_direct",
            f"Current active jobs matching ({family}) in {place}, posted within roughly the last {days} days. "
            "Search direct employer career sites broadly across companies and sectors, including employers that may not be indexed by major job boards. "
            "Return exact job-detail/application pages.",
        ),
        (
            "major_ats",
            f"Current active jobs matching ({family}) in {place}, posted within roughly the last {days} days, across Greenhouse, Lever, Workday, SmartRecruiters, Ashby and Workable. "
            "Return exact vacancy/application URLs and search across many employers, not a fixed company list.",
        ),
        (
            "enterprise_ats",
            f"Current active jobs matching ({family}) in {place}, posted within roughly the last {days} days, across iCIMS, SAP SuccessFactors, Oracle Recruiting/Oracle Cloud and employer-hosted enterprise ATS pages. "
            "Return exact vacancy/application URLs.",
        ),
        (
            "indexed_uk_market",
            f"Current active jobs matching ({family}) in {place}, posted within roughly the last {days} days, visible through LinkedIn, Indeed, Totaljobs, Reed, CV-Library, Adzuna and other indexed UK job sources. "
            "Use these sources to find vacancies that direct ATS searches may miss; prefer an exact direct employer or ATS URL when search results expose one.",
        ),
    ]


def _run_pass(*, pass_name: str, query: str, target_role: str, location: str, freshness_days: int, max_jobs: int) -> dict[str, Any]:
    prompt = f"""You are CogniTwist Market Discovery.
Use Google Search to discover current, real job vacancies for the market query below.
This is MARKET DISCOVERY ONLY. There is no candidate profile and you must not score candidate fit.

MARKET QUERY:
{query}

TARGET ROLE / SEARCH INTENT: {target_role}
LOCATION: {location}
FRESHNESS WINDOW: approximately {freshness_days} days
MAX RESULTS FOR THIS PASS: {max_jobs}

Rules:
- Maximise recall while staying relevant to the requested role family and location.
- Search broadly and independently; do not assume one job board represents the market.
- Prefer direct employer career pages and direct ATS job-detail/application pages.
- Include legitimate direct employer career URLs even when the employer uses a custom careers domain.
- Use job boards/indexed sources as discovery leads when a direct vacancy page cannot be found.
- Avoid generic company homepages, generic careers landing pages and generic search-result pages when an exact vacancy page is available.
- Do not invent jobs, dates, salaries, employers or URLs.
- Return only vacancies supported by grounded Google Search results.
- Use the exact HTTPS vacancy/application URL when available.
- source_type must be one of: direct_employer, ats, indexed_job_source.
- Keep descriptions concise and factual.
- Return valid JSON only.
"""

    client = genai.Client()
    model = os.getenv("MARKET_DISCOVERY_MODEL", DEFAULT_MODEL)
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "tools": [{"google_search": {}}],
            "response_format": {
                "text": {
                    "mime_type": "application/json",
                    "schema": _schema(),
                }
            },
            "temperature": 0.0,
        },
    )
    payload = _parse_json_text(getattr(response, "text", "") or "")
    raw_jobs = payload.get("jobs", []) if isinstance(payload, dict) else []
    jobs: list[dict[str, Any]] = []
    for item in raw_jobs if isinstance(raw_jobs, list) else []:
        if not isinstance(item, dict):
            continue
        link = _safe_https_job_url(item.get("link"))
        title = _clean(item.get("title"), 300)
        company = _clean(item.get("company"), 300)
        if not link or not title or not company:
            continue
        source_type = _clean(item.get("source_type"), 80)
        if source_type not in {"direct_employer", "ats", "indexed_job_source"}:
            source_type = "indexed_job_source"
        jobs.append(
            {
                "title": title,
                "company": company,
                "location": _clean(item.get("location"), 240) or location,
                "salary": _clean(item.get("salary"), 240) or "Not disclosed",
                "posted": _clean(item.get("posted"), 160),
                "description": _clean(item.get("description"), 2200),
                "skills": [_clean(skill, 120) for skill in (item.get("skills") or [])[:12] if _clean(skill, 120)],
                "link": link,
                "remote": "remote" in f"{item.get('location', '')} {item.get('description', '')}".lower(),
                "source": f"Grounded · {source_type.replace('_', ' ').title()}",
                "source_type": source_type,
                "direct": source_type in {"direct_employer", "ats"},
                "discovery_pass": pass_name,
            }
        )
    return {"pass": pass_name, "jobs": jobs[:max_jobs]}


def discover_market_jobs(*, target_role: str, location: str, freshness_days: int = 14, max_jobs: int = 100) -> dict[str, Any]:
    role = _clean(target_role, 300)
    place = _clean(location, 200)
    if not role:
        return {"jobs": [], "passes": [], "errors": ["target role is required"]}

    days = max(1, min(90, int(freshness_days or 14)))
    requested_max = max(1, min(MAX_TOTAL_JOBS, int(max_jobs or 100)))
    variants, passes = _query_passes(role, place, days)
    per_pass = min(MAX_PASS_JOBS, max(12, (requested_max + len(passes) - 1) // len(passes) + 5))

    results: list[dict[str, Any]] = []
    errors: list[str] = []
    workers = min(4, len(passes))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        future_map = {
            pool.submit(
                _run_pass,
                pass_name=pass_name,
                query=query,
                target_role=" | ".join(variants),
                location=place,
                freshness_days=days,
                max_jobs=per_pass,
            ): pass_name
            for pass_name, query in passes
        }
        for future in as_completed(future_map):
            pass_name = future_map[future]
            try:
                results.append(future.result())
            except Exception:
                errors.append(pass_name)

    merged: dict[str, dict[str, Any]] = {}
    for result in results:
        for job in result.get("jobs", []):
            key = _job_key(job)
            existing = merged.get(key)
            if not existing or (job.get("direct") and not existing.get("direct")):
                merged[key] = job

    jobs = list(merged.values())[:requested_max]
    return {
        "jobs": jobs,
        "total": len(jobs),
        "role_variants": variants,
        "passes": [result.get("pass") for result in results],
        "failed_passes": errors,
        "search_strategy": "four-pass grounded market discovery: broad direct + major ATS + enterprise ATS + indexed UK market; role-family variants included; candidate profile excluded",
        "coverage_confidence": "expanded_not_exhaustive",
        "coverage_note": "Expanded discovery searches multiple independent market lanes and equivalent role titles. No public-web search can prove literal 100% coverage because some vacancies are unindexed, authenticated, blocked from crawling or published only inside closed platforms.",
    }
