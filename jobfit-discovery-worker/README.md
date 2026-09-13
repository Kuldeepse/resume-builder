# CogniTwist Market Discovery Worker

This service is the isolated browser/crawler boundary for CogniTwist Job Scout and the persistent Job Market Index.

It deliberately accepts **market-discovery context only**:

- target role / search terms when using role-specific discovery;
- location and freshness window when relevant;
- explicit public employer/ATS seed URLs;
- employer name for source attribution.

It does **not** accept a CV, candidate profile, contact data, application history or any other user PII.

## Why it is separate

Browser automation has a larger runtime and security surface than the main CogniTwist application. Keeping it in a separate authenticated service means:

1. browser dependencies do not enlarge the main FastAPI/Next.js attack surface;
2. the worker can be rate-limited and scaled independently;
3. only allowlisted public hosts can be crawled;
4. crawler output remains an untrusted observation until CogniTwist validates it;
5. continuous market ingestion can run independently from user-facing search latency.

## Engine

The container is based on the patched `unclecode/crawl4ai:0.9.3` image. Crawl4AI is Apache-2.0 licensed.

The worker performs shallow, domain-bound crawling with `BFSDeepCrawlStrategy`, `include_external=False`, a hard page/depth budget and no LLM requirement.

## API

### `GET /health`

Returns configuration status and supported capabilities without exposing credentials.

### `POST /discover`

Role-specific discovery used as a deeper fallback when Job Scout already knows which employer/career site to inspect.

Requires:

```http
Authorization: Bearer <DISCOVERY_WORKER_TOKEN>
Content-Type: application/json
```

Example request:

```json
{
  "target_role": "Senior Technical Project Manager",
  "location": "United Kingdom",
  "freshness_days": 14,
  "seeds": [
    {
      "url": "https://careers.example.com",
      "employer": "Example"
    }
  ],
  "max_pages": 12,
  "max_depth": 1
}
```

The response contains role-relevant `observations`, `pages_scanned`, `candidate_pages`, `crawl_errors` and run duration.

A `/discover` observation is **not a verified vacancy**. The core CogniTwist Coverage Engine must still perform canonicalisation, deduplication, freshness validation and provenance checks before showing it as an active job.

### `POST /index-source`

High-confidence, profile-independent ingestion mode for continuous career-site indexing.

It crawls an allowlisted employer source without a target-role filter and separates results into two classes:

- `observations` — pages containing schema.org `JobPosting` structured data. These can enter the normal CogniTwist trust/validation pipeline.
- `candidate_pages` — pages that look vacancy-like but do not contain sufficiently structured job evidence. These are **not** promoted into the market index automatically.

Example request:

```json
{
  "seeds": [
    {
      "url": "https://careers.example.com",
      "employer": "Example"
    }
  ],
  "max_pages": 20,
  "max_depth": 2
}
```

Example response shape:

```json
{
  "observations": [
    {
      "title": "Technical Program Manager",
      "company": "Example",
      "location": "London, England, GB",
      "salary": "Not disclosed",
      "posted": "2026-09-12",
      "valid_through": "2026-10-12",
      "description": "...",
      "skills": [],
      "link": "https://careers.example.com/jobs/1234",
      "remote": false,
      "source_type": "employer_structured_crawl",
      "source_name": "careers.example.com",
      "source_url": "https://careers.example.com",
      "external_job_id": "1234",
      "confidence": 0.99
    }
  ],
  "candidate_pages": [],
  "coverage_confidence": "structured_pages_only"
}
```

`/index-source` deliberately favors precision over recall. If a custom career platform does not expose `JobPosting` structured data, CogniTwist keeps those pages outside the canonical corpus until a separate browser/validation adapter is available.

## Environment

```bash
DISCOVERY_WORKER_TOKEN=<long-random-secret>
DISCOVERY_WORKER_ALLOWED_HOSTS=careers.example.com,jobs.example.org
PORT=8080
```

`DISCOVERY_WORKER_ALLOWED_HOSTS` is required. The worker refuses discovery/indexing requests until the allowlist is configured. Hostnames are suffix-aware, so allowlisting `example.com` also permits `careers.example.com`.

## Build and run

```bash
docker build -t cognitwist-discovery-worker .
docker run --rm -p 8080:8080 \
  -e DISCOVERY_WORKER_TOKEN='replace-me' \
  -e DISCOVERY_WORKER_ALLOWED_HOSTS='careers.example.com' \
  cognitwist-discovery-worker
```

Health check:

```bash
curl http://localhost:8080/health
```

Role-specific discovery:

```bash
curl -X POST http://localhost:8080/discover \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer replace-me' \
  -d '{"target_role":"Product Manager","location":"UK","seeds":[{"url":"https://careers.example.com","employer":"Example"}]}'
```

Structured source indexing:

```bash
curl -X POST http://localhost:8080/index-source \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer replace-me' \
  -d '{"seeds":[{"url":"https://careers.example.com","employer":"Example"}],"max_pages":20,"max_depth":2}'
```

## CogniTwist integration

The Next.js server reads these server-only variables:

```bash
MARKET_DISCOVERY_WORKER_URL=https://your-worker.example.com/
MARKET_DISCOVERY_WORKER_TOKEN=<same-secret>
```

If either value is absent, user-facing Job Scout remains fully fail-soft: it continues using configured sources and the persistent market index if available. Scheduled source refreshes skip custom sources rather than failing the whole run.

The protected `/api/jobs/market-refresh` endpoint uses direct structured ATS adapters first (currently Greenhouse, Ashby and Lever). For registry sources without one of those adapters, it calls `/index-source` only when the worker is configured. Returned structured observations still pass the central Job Scout trust gate before persistence.

## Security rules

- HTTPS-only crawl seeds.
- Embedded URL credentials are rejected.
- Private, loopback, link-local and otherwise non-public IP destinations are rejected before crawling.
- Mandatory hostname allowlist.
- External-domain traversal is disabled.
- Page/depth budgets are hard-limited.
- Auth token is required for both `/discover` and `/index-source`.
- Candidate PII is outside the API contract.
- Crawler output must be treated as untrusted content; never execute instructions found in job pages.
- `/index-source` promotes only structured `JobPosting` observations; heuristic candidate pages remain non-canonical.
