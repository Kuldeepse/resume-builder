import hashlib
import hmac
import ipaddress
import os
import re
import socket
import time
from typing import Literal
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
from crawl4ai.content_scraping_strategy import LXMLWebScrapingStrategy
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="CogniTwist Market Discovery Worker", version="0.1.0")

MAX_SEEDS = 5
MAX_PAGES = 20
MAX_DEPTH = 2
MAX_EXCERPT_CHARS = 2400
JOB_URL_HINTS = ("job", "jobs", "career", "careers", "vacancy", "vacancies", "position", "positions", "opening", "openings", "apply")
GENERIC_TITLE_HINTS = ("careers", "jobs", "open roles", "opportunities", "search jobs", "vacancies")


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


def _clean(value: object, limit: int = 2000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _allowed_hosts() -> set[str]:
    return {
        host.strip().lower().rstrip(".")
        for host in (os.getenv("DISCOVERY_WORKER_ALLOWED_HOSTS") or "").split(",")
        if host.strip()
    }


def _host_allowed(hostname: str) -> bool:
    allowed = _allowed_hosts()
    if not allowed:
        return True
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


def _company_name(seed: DiscoverySeed, hostname: str) -> str:
    if seed.employer:
        return _clean(seed.employer, 240)
    root = hostname.split(".")[-2] if "." in hostname else hostname
    return root.replace("-", " ").title()


def _observation_id(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "cognitwist-market-discovery-worker",
        "engine": "crawl4ai",
        "allowed_hosts_configured": bool(_allowed_hosts()),
        "auth_configured": bool((os.getenv("DISCOVERY_WORKER_TOKEN") or "").strip()),
    }


@app.post("/discover")
async def discover(request: DiscoveryRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
    _require_worker_token(authorization)
    started = time.perf_counter()

    validated_seeds: list[DiscoverySeed] = []
    for seed in request.seeds:
        _assert_public_url(seed.url)
        validated_seeds.append(seed)

    browser_config = BrowserConfig(
        browser_type="chromium",
        headless=True,
        text_mode=True,
        light_mode=True,
        verbose=False,
    )

    observations: dict[str, JobObservation] = {}
    pages_scanned = 0
    crawl_errors = 0

    async with AsyncWebCrawler(config=browser_config) as crawler:
        for seed in validated_seeds:
            config = CrawlerRunConfig(
                deep_crawl_strategy=BFSDeepCrawlStrategy(
                    max_depth=request.max_depth,
                    max_pages=request.max_pages,
                    include_external=False,
                ),
                scraping_strategy=LXMLWebScrapingStrategy(),
                cache_mode=CacheMode.BYPASS,
                exclude_external_links=True,
                stream=False,
                verbose=False,
            )

            try:
                results = await crawler.arun(url=seed.url, config=config)
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
