# CogniTwist Job Agent Contract

CogniTwist can use an external open-source agent (for example Hermes) for job discovery and ranking without coupling the product API to one agent framework.

## Configuration

Set these environment variables on the backend service:

- `JOB_AGENT_URL` — HTTPS endpoint exposed by the agent service.
- `JOB_AGENT_TOKEN` — optional bearer token for that endpoint.
- `JOB_AGENT_TIMEOUT_SECONDS` — optional timeout, default 25 seconds, clamped to 5–60 seconds.

When `JOB_AGENT_URL` is absent or the agent fails, CogniTwist keeps the existing production job-search path as a fallback.

## Request

CogniTwist sends JSON with:

- `task`: `discover_score_and_rank_jobs`
- `target_role`
- `location`
- `candidate_profile`
- `constraints`, including freshness, maximum jobs, deduplication, preferred direct-employer URLs, allowed source classes and `never_auto_apply=true`
- `response_schema` describing the expected response fields

The agent should search only lawful/publicly accessible sources, respect source terms and rate limits, avoid automated applications, and prefer employer/ATS URLs.

## Response

Return a JSON object with:

```json
{
  "jobs": [
    {
      "title": "",
      "company": "",
      "location": "",
      "salary": "",
      "posted": "",
      "description": "",
      "skills": [],
      "link": "https://...",
      "match_score": 0,
      "matched_requirements": [],
      "missing_requirements": [],
      "recommendation": "Apply"
    }
  ],
  "best_match_summary": ""
}
```

`recommendation` must be one of `Apply`, `Apply after tailoring`, or `Review carefully`.

The backend still sanitises URLs, score ranges and text before returning data to the frontend.

## Hermes implementation direction

A Hermes worker should orchestrate constrained sub-tasks for discovery, live-page verification, JD extraction and deduplication. The agent should return the stable contract above; CogniTwist remains responsible for the product UI, data controls, ranking policy and commercial entitlements.
