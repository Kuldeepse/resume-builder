import hashlib
import hmac
import ipaddress
import json
import os
import re
import socket
import time
from html import unescape
from typing import Any, Literal
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
from crawl4ai.content_scraping_strategy import LXMLWebScrapingStrategy
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="CogniTwist Market Discovery Worker", version="0.2.0")

MAX_SEEDS = 5
MAX_PAGES = 20
MAX_DEPTH = 2
MAX_EXCERPT_CHARS = 2400
JOB_URL_HINTS = ("job", "jobs", "career", "careers", "vacancy", "vacancies", "position", "positions", "opening", "openings", "apply")
GENERIC_TITLE_HINTS = ("careers", "jobs", "open roles", "opportunities", "search jobs", "vacancies")
JSON_LD_PATTERN = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
    flags=re.I,
)


class DiscoverySeed(BaseModel):
    url: str = Field(min_length=8, max_length=1800)
    employer: str | None = Field(default=None, max_length=240)


class DiscoveryRequest(BaseModel):
    target_role: str = Field(min_length=2, max_length=300)
    location: str = Field(default="", max_length=200)
    freshness_days: int = Field(default=14, ge=1, le=90)
    seeds: list[DiscoverySeed] = Field(min_length=1, max_length=MAX_SEEDS)
    max_pages: int = Field(default=12, ge=1, le=MAX_PAGES)
    max_depth: int = Field(default=1, ge=0, le=MAX_DEPTH)


class SourceIndexRequest(BaseModel):
    seeds: list[DiscoverySeed] = Field(min_length=1, max_length=MAX_SEEDS)
    max_pages: int = Field(default=20, ge=1, le=MAX_PAGES)
    max_depth: int = Field(default=2, ge=0, le=MAX_DEPTH)


class JobObservation(BaseModel):
    title: str
    company: str
    location: str
    salary: str
    posted: str
    description: str
    skills: list[str]
    link: str
    remote: bool
    source_type: Literal["employer_crawl"] = "employer_crawl"
    source_name: str
    source_url: str
    external_job_id: str
    confidence: float = Field(ge=0, le=1)


class StructuredJobObservation(BaseModel):
    title: str
    company: str
    location: str
    salary: str
    posted: str
    valid_through: str
    description: str
    skills: list[str]
    link: str
    remote: bool
    source_type: Literal["employer_structured_crawl"] = "employer_structured_crawl"
    source_name: str
    source_url: str
    external_job_id: str
    confidence: float = Field(default=0.99, ge=0, le=1)


class CandidatePage(BaseModel):
    title: str
    link: str
    source_name: str
    source_url: str
    confidence: float = Field(ge=0, le=1)


def _clean(value: object, limit: int = 2000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _strip_html(value: object, limit: int = MAX_EXCERPT_CHARS) -> str:
    text = str(value or "")
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return _clean(unescape(text), limit)


def _allowed_hosts() -> set[str]:
    return {
        host.strip().lower().rstrip(".")
        for host in (os.getenv("DISCOVERY_WORKER_ALLOWED_HOSTS") or "").split(",")
        if host.strip()
    }


def _host_allowed(hostname: str) -> bool:
    allowed = _allowed_hosts()
    if not allowed:
        return False
    return any(hostname == host or hostname.endswith(f".{host}") for host in allowed)


def _assert_public_url(value: str) -> str:
    try:
        parsed = urlparse(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="A discovery seed URL is invalid.") from exc

    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Discovery seed URLs must use HTTPS.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Discovery seed URLs must not contain credentials.")

    hostname = parsed.hostname.lower().rstrip(".")
    if not _host_allowed(hostname):
        raise HTTPException(status_code=400, detail="A discovery seed host is not allowlisted.")

    try:
        literal_ip = ipaddress.ip_address(hostname)
        if not literal_ip.is_global:
            raise HTTPException(status_code=400, detail="Discovery seeds must target public internet hosts.")
        return value
    except ValueError:
        pass

    try:
        resolved = socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="A discovery seed host could not be resolved safely.") from exc

    addresses = {item[4][0] for item in resolved if item and item[4]}
    if not addresses:
        raise HTTPException(status_code=400, detail="A discovery seed host did not resolve.")

    for address in addresses:
        try:
            resolved_ip = ipaddress.ip_address(address)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="A discovery seed resolved to an invalid address.") from exc
        if not resolved_ip.is_global:
            raise HTTPException(status_code=400, detail="Discovery seeds must not resolve to private or non-public addresses.")

    return value


def _require_worker_token(authorization: str | None) -> None:
    expected = (os.getenv("DISCOVERY_WORKER_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Discovery worker authentication is not configured.")
    if not _allowed_hosts():
        raise HTTPException(status_code=503, detail="Discovery worker host allowlist is not configured.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    supplied = authorization.removeprefix("Bearer ").strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Authentication failed.")


def _markdown_text(result: object) -> str:
    markdown = getattr(result, "markdown", "")
    for attribute in ("fit_markdown", "raw_markdown"):
        value = getattr(markdown, attribute, None)
        if value:
            return str(value)
    return str(markdown or "")


def _result_html(result: object) -> str:
    for attribute in ("html", "cleaned_html"):
        value = getattr(result, attribute, None)
        if value:
            return str(value)
    return ""


def _role_tokens(value: str) -> list[str]:
    stop = {"and", "the", "for", "with", "senior", "lead", "manager", "management", "technical"}
    return [token for token in re.findall(r"[a-z0-9+#.]{3,}", value.lower()) if token not in stop]


def _score_page(*, title: str, url: str, markdown: str, target_role: str, location: str) -> int:
    role = target_role.lower().strip()
    tokens = _role_tokens(target_role)
    title_l = title.lower()
    url_l = url.lower()
    text_l = markdown[:12000].lower()
    score = 0

    if role and role in title_l:
        score += 85
    if role and role in text_l:
        score += 30
    title_hits = sum(1 for token in tokens if token in title_l)
    text_hits = sum(1 for token in tokens if token in text_l)
    score += title_hits * 18
    score += min(35, text_hits * 7)
    if any(hint in url_l for hint in JOB_URL_HINTS):
        score += 25
    if location and location.lower().strip() in f"{title_l} {text_l}":
        score += 10
    if any(hint == title_l.strip() for hint in GENERIC_TITLE_HINTS):
        score -= 35
    return max(0, score)


def _candidate_page_score(title: str, url: str, markdown: str) -> int:
    title_l = title.lower().strip()
    url_l = url.lower()
    text_l = markdown[:8000].lower()
    score = 0
    if any(hint in url_l for hint in JOB_URL_HINTS):
        score += 45
    if any(hint in title_l for hint in ("engineer", "manager", "analyst", "developer", "director", "architect", "specialist", "consultant", "technician", "coordinator", "officer", "scientist")):
        score += 25
    if any(marker in text_l for marker in ("job description", "responsibilities", "qualifications", "apply now", "employment type")):
        score += 20
    if any(hint == title_l for hint in GENERIC_TITLE_HINTS):
        score -= 50
    return max(0, score)


def _company_name(seed: DiscoverySeed, hostname: str) -> str:
    if seed.employer:
        return _clean(seed.employer, 240)
    root = hostname.split(".")[-2] if "." in hostname else hostname
    return root.replace("-", " ").title()


def _observation_id(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]


def _json_ld_nodes(value: Any) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if isinstance(value.get("@graph"), list):
            for child in value["@graph"]:
                nodes.extend(_json_ld_nodes(child))
        nodes.append(value)
    elif isinstance(value, list):
        for child in value:
            nodes.extend(_json_ld_nodes(child))
    return nodes


def _is_job_posting(node: dict[str, Any]) -> bool:
    raw_type = node.get("@type")
    if isinstance(raw_type, list):
        return any(str(item).lower() == "jobposting" for item in raw_type)
    return str(raw_type or "").lower() == "jobposting"


def _location_from_job_posting(node: dict[str, Any]) -> str:
    values: list[str] = []
    locations = node.get("jobLocation")
    if not isinstance(locations, list):
        locations = [locations] if locations else []
    for location in locations:
        if not isinstance(location, dict):
            continue
        address = location.get("address")
        if not isinstance(address, dict):
            continue
        parts = [
            address.get("addressLocality"),
            address.get("addressRegion"),
            address.get("postalCode"),
            address.get("addressCountry"),
        ]
        rendered = ", ".join(_clean(part, 120) for part in parts if _clean(part, 120))
        if rendered:
            values.append(rendered)

    applicant = node.get("applicantLocationRequirements")
    if not values and applicant:
        candidates = applicant if isinstance(applicant, list) else [applicant]
        for candidate in candidates:
            if isinstance(candidate, dict):
                name = _clean(candidate.get("name"), 180)
                if name:
                    values.append(name)

    if str(node.get("jobLocationType") or "").upper() == "TELECOMMUTE":
        values.insert(0, "Remote")
    return " · ".join(dict.fromkeys(values)) or "Location not confirmed"


def _salary_from_job_posting(node: dict[str, Any]) -> str:
    base_salary = node.get("baseSalary")
    if not isinstance(base_salary, dict):
        return "Not disclosed"
    currency = _clean(base_salary.get("currency"), 20)
    value = base_salary.get("value")
    if isinstance(value, dict):
        minimum = value.get("minValue")
        maximum = value.get("maxValue")
        exact = value.get("value")
        unit = _clean(value.get("unitText"), 40)
        if minimum is not None and maximum is not None:
            return _clean(f"{currency} {minimum}–{maximum}{f' / {unit}' if unit else ''}", 240)
        if exact is not None:
            return _clean(f"{currency} {exact}{f' / {unit}' if unit else ''}", 240)
    if isinstance(value, (str, int, float)):
        return _clean(f"{currency} {value}", 240)
    return "Not disclosed"


def _skills_from_job_posting(node: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("skills", "qualifications", "experienceRequirements", "educationRequirements"):
        value = node.get(key)
        if isinstance(value, str):
            text = _strip_html(value, 800)
            if text:
                values.extend(part.strip() for part in re.split(r"[,;|•]", text) if part.strip())
        elif isinstance(value, list):
            values.extend(_clean(item, 120) for item in value if _clean(item, 120))
    return list(dict.fromkeys(item[:120] for item in values if item))[:12]


def _structured_observations(
    *,
    html: str,
    result_url: str,
    seed: DiscoverySeed,
    hostname: str,
) -> list[StructuredJobObservation]:
    observations: list[StructuredJobObservation] = []
    for script in JSON_LD_PATTERN.findall(html or ""):
        raw = unescape(script).strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
        for node in _json_ld_nodes(payload):
            if not _is_job_posting(node):
                continue
            title = _clean(node.get("title"), 300)
            hiring_org = node.get("hiringOrganization")
            structured_company = _clean(hiring_org.get("name"), 240) if isinstance(hiring_org, dict) else ""
            company = structured_company or _company_name(seed, hostname)
            if not title or not company:
                continue

            candidate_url = _clean(node.get("url"), 1800) or result_url
            try:
                _assert_public_url(candidate_url)
            except HTTPException:
                candidate_url = result_url
            description = _strip_html(node.get("description"), MAX_EXCERPT_CHARS)
            location = _location_from_job_posting(node)
            posted = _clean(node.get("datePosted"), 160)
            valid_through = _clean(node.get("validThrough"), 160)
            remote = str(node.get("jobLocationType") or "").upper() == "TELECOMMUTE" or "remote" in location.lower()
            external_id = _clean(node.get("identifier"), 200)
            if isinstance(node.get("identifier"), dict):
                identifier = node["identifier"]
                external_id = _clean(identifier.get("value") or identifier.get("name"), 200)
            external_id = external_id or _observation_id(candidate_url)

            observations.append(
                StructuredJobObservation(
                    title=title,
                    company=company,
                    location=location,
                    salary=_salary_from_job_posting(node),
                    posted=posted,
                    valid_through=valid_through,
                    description=description,
                    skills=_skills_from_job_posting(node),
                    link=candidate_url,
                    remote=remote,
                    source_name=hostname,
                    source_url=seed.url,
                    external_job_id=external_id[:240],
                    confidence=0.99,
                )
            )
    return observations


def _crawler_config(max_depth: int, max_pages: int) -> CrawlerRunConfig:
    return CrawlerRunConfig(
        deep_crawl_strategy=BFSDeepCrawlStrategy(
            max_depth=max_depth,
            max_pages=max_pages,
            include_external=False,
        ),
        scraping_strategy=LXMLWebScrapingStrategy(),
        cache_mode=CacheMode.BYPASS,
        exclude_external_links=True,
        stream=False,
        verbose=False,
    )


def _browser_config() -> BrowserConfig:
    return BrowserConfig(
        browser_type="chromium",
        headless=True,
        text_mode=True,
        light_mode=True,
        verbose=False,
    )


@app.get("/health")
async def health() -> dict[str, object]:
    auth_configured = bool((os.getenv("DISCOVERY_WORKER_TOKEN") or "").strip())
    allowed_hosts_configured = bool(_allowed_hosts())
    return {
        "ok": auth_configured and allowed_hosts_configured,
        "service": "cognitwist-market-discovery-worker",
        "engine": "crawl4ai",
        "version": "0.2.0",
        "allowed_hosts_configured": allowed_hosts_configured,
        "auth_configured": auth_configured,
        "capabilities": ["role_discovery", "structured_source_indexing"],
    }


@app.post("/discover")
async def discover(request: DiscoveryRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
    _require_worker_token(authorization)
    started = time.perf_counter()

    validated_seeds: list[DiscoverySeed] = []
    for seed in request.seeds:
        _assert_public_url(seed.url)
        validated_seeds.append(seed)

    observations: dict[str, JobObservation] = {}
    pages_scanned = 0
    crawl_errors = 0

    async with AsyncWebCrawler(config=_browser_config()) as crawler:
        for seed in validated_seeds:
            try:
                results = await crawler.arun(
                    url=seed.url,
                    config=_crawler_config(request.max_depth, request.max_pages),
                )
            except Exception:
                crawl_errors += 1
                continue

            if not isinstance(results, list):
                results = [results]

            for result in results[: request.max_pages]:
                if not getattr(result, "success", False):
                    crawl_errors += 1
                    continue
                result_url = _clean(getattr(result, "url", ""), 1800)
                if not result_url:
                    continue
                try:
                    _assert_public_url(result_url)
                except HTTPException:
                    continue

                pages_scanned += 1
                metadata = getattr(result, "metadata", {}) or {}
                title = _clean(metadata.get("title", ""), 300)
                markdown = _markdown_text(result)
                score = _score_page(
                    title=title,
                    url=result_url,
                    markdown=markdown,
                    target_role=request.target_role,
                    location=request.location,
                )
                if score < 45:
                    continue

                parsed = urlparse(result_url)
                hostname = (parsed.hostname or "").lower()
                description = _clean(markdown, MAX_EXCERPT_CHARS)
                confidence = min(0.95, max(0.35, 0.35 + score / 220))
                external_id = _observation_id(result_url)

                observations[external_id] = JobObservation(
                    title=title or request.target_role,
                    company=_company_name(seed, hostname),
                    location=_clean(request.location, 200) or "Location not confirmed",
                    salary="Not disclosed",
                    posted="Not confirmed",
                    description=description,
                    skills=[],
                    link=result_url,
                    remote="remote" in f"{title} {description[:1200]}".lower(),
                    source_name=hostname,
                    source_url=seed.url,
                    external_job_id=external_id,
                    confidence=round(confidence, 2),
                )

    return {
        "observations": [item.model_dump() for item in observations.values()],
        "pages_scanned": pages_scanned,
        "candidate_pages": len(observations),
        "crawl_errors": crawl_errors,
        "duration_ms": round((time.perf_counter() - started) * 1000),
        "coverage_confidence": "not_measured",
        "note": "Crawler observations are market-discovery candidates only. CogniTwist must canonicalise, deduplicate and validate freshness before candidate fit scoring.",
    }


@app.post("/index-source")
async def index_source(request: SourceIndexRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
    """Index high-confidence JobPosting structured data from allowlisted employer career sites.

    Unstructured pages are returned separately as candidates and are never promoted to jobs here.
    This keeps continuous ingestion precision-first while preserving a later browser/AI review path.
    """
    _require_worker_token(authorization)
    started = time.perf_counter()

    validated_seeds: list[DiscoverySeed] = []
    for seed in request.seeds:
        _assert_public_url(seed.url)
        validated_seeds.append(seed)

    structured: dict[str, StructuredJobObservation] = {}
    candidates: dict[str, CandidatePage] = {}
    pages_scanned = 0
    pages_with_jobposting = 0
    crawl_errors = 0

    async with AsyncWebCrawler(config=_browser_config()) as crawler:
        for seed in validated_seeds:
            try:
                results = await crawler.arun(
                    url=seed.url,
                    config=_crawler_config(request.max_depth, request.max_pages),
                )
            except Exception:
                crawl_errors += 1
                continue

            if not isinstance(results, list):
                results = [results]

            for result in results[: request.max_pages]:
                if not getattr(result, "success", False):
                    crawl_errors += 1
                    continue
                result_url = _clean(getattr(result, "url", ""), 1800)
                if not result_url:
                    continue
                try:
                    _assert_public_url(result_url)
                except HTTPException:
                    continue

                pages_scanned += 1
                parsed = urlparse(result_url)
                hostname = (parsed.hostname or "").lower()
                html = _result_html(result)
                observations = _structured_observations(
                    html=html,
                    result_url=result_url,
                    seed=seed,
                    hostname=hostname,
                )

                if observations:
                    pages_with_jobposting += 1
                    for observation in observations:
                        structured[_observation_id(observation.link)] = observation
                    continue

                metadata = getattr(result, "metadata", {}) or {}
                title = _clean(metadata.get("title", ""), 300)
                markdown = _markdown_text(result)
                score = _candidate_page_score(title, result_url, markdown)
                if score < 50:
                    continue
                candidate_id = _observation_id(result_url)
                candidates[candidate_id] = CandidatePage(
                    title=title or "Potential vacancy page",
                    link=result_url,
                    source_name=hostname,
                    source_url=seed.url,
                    confidence=round(min(0.85, 0.35 + score / 160), 2),
                )

    return {
        "observations": [item.model_dump() for item in structured.values()],
        "candidate_pages": [item.model_dump() for item in candidates.values()],
        "pages_scanned": pages_scanned,
        "pages_with_jobposting": pages_with_jobposting,
        "structured_jobs": len(structured),
        "unstructured_candidates": len(candidates),
        "crawl_errors": crawl_errors,
        "duration_ms": round((time.perf_counter() - started) * 1000),
        "coverage_confidence": "structured_pages_only",
        "note": "Only schema.org JobPosting observations are promoted as jobs. Unstructured candidate pages require a separate validation/browser stage before canonical indexing.",
    }
