import ipaddress
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from typing import Any
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from google import genai

DEFAULT_MODEL = "gemini-2.5-flash"
MAX_PASS_JOBS = 30
MAX_TOTAL_JOBS = 140
MAX_BOARD_SEEDS = 12

UK_SIGNALS = (
    "united kingdom", " uk", "uk ", "england", "scotland", "wales", "northern ireland",
    "london", "manchester", "birmingham", "bristol", "leeds", "liverpool", "cardiff",
    "edinburgh", "glasgow", "belfast", "southampton", "reading", "cambridge", "oxford",
    "newcastle", "nottingham", "sheffield", "milton keynes", "slough", "portsmouth",
    "guildford", "brighton", "aberdeen", "remote - uk", "remote uk",
)
US_SIGNALS = (
    "united states", " usa", "usa ", " california", " new york", " texas", " virginia",
    " florida", " washington", " massachusetts", " illinois", " colorado", " georgia",
)
GENERIC_ROLE_WORDS = {
    "senior", "lead", "principal", "technical", "manager", "management", "head", "the",
    "and", "for", "with", "role", "jobs", "job", "programme", "program", "project",
}


def _clean(value: Any, limit: int = 3000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _strip_html(value: Any, limit: int = 3000) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", str(value or ""), flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return _clean(unescape(text), limit)


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
                        "title", "company", "location", "salary", "posted", "description",
                        "skills", "link", "source_type",
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
            "Search direct employer career sites broadly across companies and sectors, including employers that may not be indexed by major job boards. Return exact job-detail/application pages.",
        ),
        (
            "major_ats",
            f"Current active jobs matching ({family}) in {place}, posted within roughly the last {days} days, across Greenhouse, Lever, Workday, SmartRecruiters, Ashby and Workable. Return exact vacancy/application URLs and search across many employers, not a fixed company list.",
        ),
        (
            "enterprise_ats",
            f"Current active jobs matching ({family}) in {place}, posted within roughly the last {days} days, across iCIMS, SAP SuccessFactors, Oracle Recruiting/Oracle Cloud and employer-hosted enterprise ATS pages. Return exact vacancy/application URLs.",
        ),
        (
            "indexed_uk_market",
            f"Current active jobs matching ({family}) in {place}, posted within roughly the last {days} days, visible through LinkedIn, Indeed, Totaljobs, Reed, CV-Library, Adzuna and other indexed UK job sources. Use these sources to find vacancies that direct ATS searches may miss; prefer an exact direct employer or ATS URL when search results expose one.",
        ),
    ]


def _run_pass(*, pass_name: str, query: str, target_role: str, location: str, freshness_days: int, max_jobs: int) -> dict[str, Any]:
    prompt = f"""You are CogniTwist Market Discovery.
Use Google Search to discover current, real job vacancies for the market query below.
This is MARKET DISCOVERY ONLY. There is no candidate profile and you must not score candidate fit.
The search intent can be a role/title, skill/technology, or employer/company name.

MARKET QUERY:
{query}

TARGET SEARCH INTENT / ROLE FAMILY: {target_role}
LOCATION: {location}
FRESHNESS WINDOW: approximately {freshness_days} days
MAX RESULTS FOR THIS PASS: {max_jobs}

Rules:
- Maximise recall while staying relevant to the requested intent and location.
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


def _board_seed(job: dict[str, Any]) -> tuple[str, str, str] | None:
    link = _safe_https_job_url(job.get("link"))
    if not link:
        return None
    parsed = urlparse(link)
    host = (parsed.hostname or "").lower()
    parts = [part for part in parsed.path.split("/") if part]
    if not parts:
        return None
    token = parts[0]
    company = _clean(job.get("company"), 240)

    if host in {"boards.greenhouse.io", "job-boards.greenhouse.io", "job-boards.eu.greenhouse.io"}:
        return "greenhouse", token, company
    if host in {"jobs.lever.co", "jobs.eu.lever.co"}:
        return "lever_eu" if host.startswith("jobs.eu.") else "lever", token, company
    if host == "jobs.ashbyhq.com":
        return "ashby", token, company
    return None


def _fetch_json(url: str, timeout: int = 8) -> Any:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "CogniTwist-JobScout/1.0"})
    with urlopen(request, timeout=timeout) as response:
        if getattr(response, "status", 200) >= 400:
            raise ValueError("ATS board returned an error status")
        raw = response.read(4 * 1024 * 1024 + 1)
        if len(raw) > 4 * 1024 * 1024:
            raise ValueError("ATS board response exceeded safety limit")
        return json.loads(raw.decode("utf-8", "replace"))


def _parse_date(value: Any) -> datetime | None:
    text = _clean(value, 100)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _fresh_enough(value: Any, days: int) -> bool:
    parsed = _parse_date(value)
    if not parsed:
        return True
    if not parsed.tzinfo:
        parsed = parsed.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds() / 86400
    return age <= max(days, 2) + 1


def _uk_relevant(location: str, description: str, requested_location: str) -> bool:
    requested = requested_location.lower().strip()
    combined = f" {location.lower()} {description[:2000].lower()} "
    if requested in {"uk", "united kingdom"}:
        if any(signal in combined for signal in UK_SIGNALS):
            return True
        if any(signal in combined for signal in US_SIGNALS):
            return False
        return "remote" in combined and ("europe" in combined or "emea" in combined or "worldwide" in combined)
    if not requested:
        return True
    return requested in combined or (requested == "remote" and "remote" in combined)


def _role_match(title: str, description: str, company: str, variants: list[str], search_intent: str) -> bool:
    title_l = title.lower()
    description_l = description[:4000].lower()
    company_l = company.lower()
    intent_l = search_intent.lower().strip()

    if intent_l and intent_l in company_l:
        return True
    if any(variant.lower() in title_l for variant in variants):
        return True

    tokens = [
        token for token in re.findall(r"[a-z0-9+#.]{3,}", " ".join(variants).lower())
        if token not in GENERIC_ROLE_WORDS
    ]
    tokens = list(dict.fromkeys(tokens))[:10]
    if not tokens:
        return intent_l in f"{title_l} {description_l}"
    title_hits = sum(1 for token in tokens if token in title_l)
    body_hits = sum(1 for token in tokens if token in description_l)
    threshold = 1 if len(tokens) <= 2 else 2
    return title_hits >= threshold or (title_hits >= 1 and body_hits >= threshold)


def _greenhouse_jobs(token: str, company: str, variants: list[str], intent: str, location: str, days: int) -> list[dict[str, Any]]:
    payload = _fetch_json(f"https://boards-api.greenhouse.io/v1/boards/{quote(token)}/jobs?content=true")
    raw_jobs = payload.get("jobs", []) if isinstance(payload, dict) else []
    jobs: list[dict[str, Any]] = []
    for item in raw_jobs if isinstance(raw_jobs, list) else []:
        title = _clean(item.get("title"), 300)
        content = _strip_html(item.get("content"), 2600)
        loc = _clean((item.get("location") or {}).get("name") if isinstance(item.get("location"), dict) else "", 240)
        if not title or not _role_match(title, content, company, variants, intent) or not _uk_relevant(loc, content, location):
            continue
        if not _fresh_enough(item.get("updated_at"), days):
            continue
        link = _safe_https_job_url(item.get("absolute_url"))
        if not link:
            continue
        jobs.append({
            "title": title,
            "company": company or token.replace("-", " ").title(),
            "location": loc or location,
            "salary": "Not disclosed",
            "posted": _clean(item.get("updated_at"), 160),
            "description": content,
            "skills": [_clean(dep.get("name"), 120) for dep in (item.get("departments") or []) if isinstance(dep, dict) and _clean(dep.get("name"), 120)][:12],
            "link": link,
            "remote": "remote" in f"{loc} {content[:1200]}".lower(),
            "source": "Direct · Greenhouse board expansion",
            "source_type": "ats",
            "direct": True,
            "discovery_pass": "ats_board_expansion",
        })
    return jobs


def _lever_jobs(kind: str, token: str, company: str, variants: list[str], intent: str, location: str, days: int) -> list[dict[str, Any]]:
    host = "api.eu.lever.co" if kind == "lever_eu" else "api.lever.co"
    payload = _fetch_json(f"https://{host}/v0/postings/{quote(token)}?mode=json")
    raw_jobs = payload if isinstance(payload, list) else []
    jobs: list[dict[str, Any]] = []
    for item in raw_jobs:
        if not isinstance(item, dict):
            continue
        title = _clean(item.get("text"), 300)
        description = _clean(item.get("descriptionPlain") or _strip_html(item.get("description")), 2600)
        categories = item.get("categories") if isinstance(item.get("categories"), dict) else {}
        loc = _clean(categories.get("location"), 240)
        created_at = item.get("createdAt")
        if isinstance(created_at, (int, float)):
            created_dt = datetime.fromtimestamp((created_at / 1000) if created_at > 10_000_000_000 else created_at, tz=timezone.utc)
            if (datetime.now(timezone.utc) - created_dt).total_seconds() / 86400 > max(days, 2) + 1:
                continue
            posted = created_dt.isoformat()
        else:
            posted = ""
        if not title or not _role_match(title, description, company, variants, intent) or not _uk_relevant(loc, description, location):
            continue
        link = _safe_https_job_url(item.get("applyUrl") or item.get("hostedUrl"))
        if not link:
            continue
        salary = item.get("salaryRange") if isinstance(item.get("salaryRange"), dict) else {}
        min_salary, max_salary = salary.get("min"), salary.get("max")
        currency = _clean(salary.get("currency"), 20)
        salary_text = f"{currency} {min_salary}–{max_salary}" if min_salary and max_salary else "Not disclosed"
        jobs.append({
            "title": title,
            "company": company or token.replace("-", " ").title(),
            "location": loc or location,
            "salary": salary_text,
            "posted": posted,
            "description": description,
            "skills": [_clean(categories.get(key), 120) for key in ("team", "department", "commitment") if _clean(categories.get(key), 120)],
            "link": link,
            "remote": "remote" in f"{loc} {item.get('workplaceType', '')}".lower(),
            "source": "Direct · Lever board expansion",
            "source_type": "ats",
            "direct": True,
            "discovery_pass": "ats_board_expansion",
        })
    return jobs


def _ashby_jobs(token: str, company: str, variants: list[str], intent: str, location: str, days: int) -> list[dict[str, Any]]:
    payload = _fetch_json(f"https://api.ashbyhq.com/posting-api/job-board/{quote(token)}?includeCompensation=true")
    raw_jobs = payload.get("jobs", []) if isinstance(payload, dict) else []
    jobs: list[dict[str, Any]] = []
    for item in raw_jobs if isinstance(raw_jobs, list) else []:
        if not isinstance(item, dict) or item.get("isListed") is False:
            continue
        title = _clean(item.get("title"), 300)
        description = _clean(item.get("descriptionPlain") or _strip_html(item.get("descriptionHtml")), 2600)
        loc = _clean(item.get("location"), 240)
        if not title or not _role_match(title, description, company, variants, intent) or not _uk_relevant(loc, description, location):
            continue
        if not _fresh_enough(item.get("publishedAt"), days):
            continue
        link = _safe_https_job_url(item.get("applyUrl") or item.get("jobUrl"))
        if not link:
            continue
        compensation = item.get("compensation") if isinstance(item.get("compensation"), dict) else {}
        salary = _clean(compensation.get("scrapeableCompensationSalarySummary") or compensation.get("compensationTierSummary"), 240) or "Not disclosed"
        jobs.append({
            "title": title,
            "company": company or token.replace("-", " ").title(),
            "location": loc or location,
            "salary": salary,
            "posted": _clean(item.get("publishedAt"), 160),
            "description": description,
            "skills": [_clean(item.get(key), 120) for key in ("department", "team", "employmentType", "workplaceType") if _clean(item.get(key), 120)],
            "link": link,
            "remote": bool(item.get("isRemote")) or "remote" in f"{loc} {item.get('workplaceType', '')}".lower(),
            "source": "Direct · Ashby board expansion",
            "source_type": "ats",
            "direct": True,
            "discovery_pass": "ats_board_expansion",
        })
    return jobs


def _expand_public_ats_boards(seed_jobs: list[dict[str, Any]], variants: list[str], intent: str, location: str, days: int) -> tuple[list[dict[str, Any]], list[str]]:
    seeds: dict[tuple[str, str], tuple[str, str, str]] = {}
    for job in seed_jobs:
        seed = _board_seed(job)
        if not seed:
            continue
        kind, token, company = seed
        seeds.setdefault((kind, token.lower()), seed)
        if len(seeds) >= MAX_BOARD_SEEDS:
            break

    if not seeds:
        return [], []

    results: list[dict[str, Any]] = []
    completed: list[str] = []

    def fetch_seed(seed: tuple[str, str, str]) -> tuple[str, list[dict[str, Any]]]:
        kind, token, company = seed
        if kind == "greenhouse":
            return f"greenhouse:{token}", _greenhouse_jobs(token, company, variants, intent, location, days)
        if kind in {"lever", "lever_eu"}:
            return f"lever:{token}", _lever_jobs(kind, token, company, variants, intent, location, days)
        if kind == "ashby":
            return f"ashby:{token}", _ashby_jobs(token, company, variants, intent, location, days)
        return f"unknown:{token}", []

    with ThreadPoolExecutor(max_workers=min(8, len(seeds))) as pool:
        futures = [pool.submit(fetch_seed, seed) for seed in seeds.values()]
        for future in as_completed(futures):
            try:
                name, jobs = future.result()
                completed.append(name)
                results.extend(jobs)
            except Exception:
                continue

    return results, completed


def discover_market_jobs(*, target_role: str, location: str, freshness_days: int = 14, max_jobs: int = 120) -> dict[str, Any]:
    role = _clean(target_role, 300)
    place = _clean(location, 200)
    if not role:
        return {"jobs": [], "passes": [], "errors": ["target role is required"]}

    days = max(1, min(90, int(freshness_days or 14)))
    requested_max = max(1, min(MAX_TOTAL_JOBS, int(max_jobs or 120)))
    variants, passes = _query_passes(role, place, days)
    per_pass = min(MAX_PASS_JOBS, max(12, (requested_max + len(passes) - 1) // len(passes) + 5))

    results: list[dict[str, Any]] = []
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=min(4, len(passes))) as pool:
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

    grounded_jobs = [job for result in results for job in result.get("jobs", [])]
    board_jobs, board_passes = _expand_public_ats_boards(grounded_jobs, variants, role, place, days)

    merged: dict[str, dict[str, Any]] = {}
    for job in [*grounded_jobs, *board_jobs]:
        key = _job_key(job)
        existing = merged.get(key)
        if not existing or (job.get("direct") and not existing.get("direct")):
            merged[key] = job

    jobs = list(merged.values())[:requested_max]
    return {
        "jobs": jobs,
        "total": len(jobs),
        "role_variants": variants,
        "passes": [result.get("pass") for result in results] + (["ats_board_expansion"] if board_passes else []),
        "failed_passes": errors,
        "ats_boards_expanded": board_passes,
        "ats_board_jobs_before_dedupe": len(board_jobs),
        "search_strategy": "four-pass grounded market discovery + public Greenhouse/Lever/Ashby board expansion; role-family variants included; candidate profile excluded",
        "coverage_confidence": "expanded_not_exhaustive",
        "coverage_note": "CogniTwist now searches multiple independent market lanes and enumerates public Greenhouse, Lever and Ashby boards discovered during search. Literal 100% internet coverage cannot be guaranteed because some vacancies are unindexed, authenticated, blocked or published only inside closed platforms.",
    }
