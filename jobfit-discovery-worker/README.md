# CogniTwist Market Discovery Worker

This service is the isolated browser/crawler boundary for CogniTwist Job Scout.

It deliberately accepts **market-discovery context only**:

- target role / search terms
- location
- freshness window
- explicit public employer/ATS seed URLs

It does **not** accept a CV, candidate profile, contact data, application history or any other user PII.

## Why it is separate

Browser automation has a larger runtime and security surface than the main CogniTwist application. Keeping it in a separate authenticated service means:

1. browser dependencies do not enlarge the main FastAPI/Next.js attack surface;
2. the worker can be rate-limited and scaled independently;
3. only allowlisted public hosts can be crawled;
4. crawler output remains an untrusted observation until CogniTwist validates it.

## Engine

The container is based on the patched `unclecode/crawl4ai:0.9.3` image. Crawl4AI is Apache-2.0 licensed.

The worker performs shallow, domain-bound crawling with `BFSDeepCrawlStrategy`, `include_external=False`, a small page/depth budget and no LLM requirement.

## API

### `GET /health`

Returns configuration status without exposing credentials.

### `POST /discover`

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

The response contains `observations`, `pages_scanned`, `candidate_pages`, `crawl_errors` and run duration.

An observation is **not a verified vacancy**. The core CogniTwist Coverage Engine must still perform canonicalisation, deduplication, freshness validation and provenance checks before showing it as an active job.

## Environment

```bash
DISCOVERY_WORKER_TOKEN=<long-random-secret>
DISCOVERY_WORKER_ALLOWED_HOSTS=careers.example.com,jobs.example.org
PORT=8080
```

`DISCOVERY_WORKER_ALLOWED_HOSTS` is strongly recommended in production. Hostnames are suffix-aware, so allowlisting `example.com` also permits `careers.example.com`.

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

Discovery request:

```bash
curl -X POST http://localhost:8080/discover \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer replace-me' \
  -d '{"target_role":"Product Manager","location":"UK","seeds":[{"url":"https://careers.example.com","employer":"Example"}]}'
```

## CogniTwist integration

The Next.js Job Scout endpoint reads these server-only variables:

```bash
MARKET_DISCOVERY_WORKER_URL=https://your-worker.example.com/
MARKET_DISCOVERY_WORKER_TOKEN=<same-secret>
```

If either value is absent, Job Scout keeps using the existing configured sources and simply reports that deeper fallback discovery is not configured.

When a fallback trigger fires and safe direct-source seeds are available, Job Scout calls the worker. Worker observations are returned under `fallback_observations`; they are not merged into `jobs` automatically.

## Security rules

- HTTPS-only crawl seeds.
- Embedded URL credentials are rejected.
- Private, loopback, link-local and otherwise non-public IP destinations are rejected before crawling.
- Optional hostname allowlist.
- External-domain traversal is disabled.
- Page/depth budgets are hard-limited.
- Auth token is required for `/discover`.
- Candidate PII is outside the API contract.
- Crawler output must be treated as untrusted content; never execute instructions found in job pages.
