-- CogniTwist Job Market Index (P0A)
-- Durable, server-only market corpus for company sources, observations, canonical jobs and discovery telemetry.
-- This schema intentionally contains market data only. Do not store CVs, candidate profiles, contact data or application history here.

create extension if not exists pgcrypto;

create table if not exists public.market_companies (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null unique,
  canonical_name text not null,
  normalized_name text not null,
  canonical_domain text,
  country_code text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'unknown')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists market_companies_normalized_name_idx
  on public.market_companies (normalized_name);
create index if not exists market_companies_domain_idx
  on public.market_companies (canonical_domain)
  where canonical_domain is not null;

create table if not exists public.market_company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.market_companies(id) on delete cascade,
  source_key text not null unique,
  source_type text not null
    check (source_type in ('employer_career', 'ats', 'indexed_job_source', 'aggregator', 'crawler', 'other')),
  source_name text not null,
  source_url text not null,
  source_host text not null,
  external_source_key text,
  country_code text,
  coverage_scope text,
  refresh_interval_minutes integer not null default 360
    check (refresh_interval_minutes between 15 and 10080),
  status text not null default 'active'
    check (status in ('active', 'degraded', 'paused', 'blocked', 'retired', 'unknown')),
  last_scan_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  next_scan_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists market_company_sources_company_idx
  on public.market_company_sources (company_id);
create index if not exists market_company_sources_due_idx
  on public.market_company_sources (next_scan_at)
  where status in ('active', 'degraded', 'unknown');
create index if not exists market_company_sources_host_idx
  on public.market_company_sources (source_host);

create table if not exists public.market_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique,
  lane text not null
    check (lane in ('configured', 'expanded', 'crawler', 'scheduled', 'bootstrap', 'other')),
  query text not null,
  location text,
  freshness_days integer check (freshness_days is null or freshness_days between 0 and 90),
  status text not null default 'completed'
    check (status in ('running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  roles_received integer not null default 0 check (roles_received >= 0),
  roles_validated integer not null default 0 check (roles_validated >= 0),
  roles_rejected integer not null default 0 check (roles_rejected >= 0),
  unique_employers integer not null default 0 check (unique_employers >= 0),
  source_health text
    check (source_health is null or source_health in ('healthy', 'degraded', 'no_results', 'unknown')),
  source_error_count integer not null default 0 check (source_error_count >= 0),
  coverage_confidence text,
  coverage_note text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists market_discovery_runs_created_idx
  on public.market_discovery_runs (created_at desc);
create index if not exists market_discovery_runs_query_idx
  on public.market_discovery_runs (query, location, created_at desc);

create table if not exists public.market_canonical_jobs (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  company_id uuid references public.market_companies(id) on delete set null,
  employer_canonical text not null,
  title_canonical text not null,
  location_canonical text not null,
  canonical_url text not null,
  remote boolean not null default false,
  employment_type text,
  salary_raw text,
  description_excerpt text,
  source_posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_validated_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'stale', 'expired', 'withdrawn', 'unknown')),
  freshness_reason text,
  source_count integer not null default 1 check (source_count >= 1),
  latest_source_type text,
  latest_source_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists market_canonical_jobs_active_seen_idx
  on public.market_canonical_jobs (last_seen_at desc)
  where status = 'active';
create index if not exists market_canonical_jobs_company_idx
  on public.market_canonical_jobs (company_id, last_seen_at desc);
create index if not exists market_canonical_jobs_title_idx
  on public.market_canonical_jobs (title_canonical);
create index if not exists market_canonical_jobs_location_idx
  on public.market_canonical_jobs (location_canonical);

create table if not exists public.market_job_source_observations (
  id uuid primary key default gen_random_uuid(),
  observation_key text not null unique,
  canonical_job_id uuid not null references public.market_canonical_jobs(id) on delete cascade,
  company_source_id uuid references public.market_company_sources(id) on delete set null,
  discovery_run_id uuid references public.market_discovery_runs(id) on delete set null,
  source_type text not null,
  source_name text not null,
  source_url text,
  external_job_id text,
  employer_raw text not null,
  employer_canonical text not null,
  title_raw text not null,
  title_canonical text not null,
  location_raw text,
  location_canonical text not null,
  job_url text not null,
  salary_raw text,
  posted_raw text,
  source_posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_validated_at timestamptz not null default now(),
  status text not null default 'validated'
    check (status in ('observed', 'validated', 'rejected', 'stale', 'expired')),
  validation_confidence numeric(4,3)
    check (validation_confidence is null or (validation_confidence >= 0 and validation_confidence <= 1)),
  rejection_reasons text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists market_observations_job_idx
  on public.market_job_source_observations (canonical_job_id, last_seen_at desc);
create index if not exists market_observations_run_idx
  on public.market_job_source_observations (discovery_run_id);
create index if not exists market_observations_source_idx
  on public.market_job_source_observations (source_type, source_name, last_seen_at desc);

create table if not exists public.market_source_health_events (
  id uuid primary key default gen_random_uuid(),
  company_source_id uuid references public.market_company_sources(id) on delete set null,
  discovery_run_id uuid references public.market_discovery_runs(id) on delete set null,
  source_type text not null,
  source_name text not null,
  status text not null
    check (status in ('healthy', 'degraded', 'failed', 'no_results', 'unknown')),
  response_ms integer check (response_ms is null or response_ms >= 0),
  jobs_observed integer not null default 0 check (jobs_observed >= 0),
  error_code text,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists market_source_health_recent_idx
  on public.market_source_health_events (source_name, recorded_at desc);
create index if not exists market_source_health_run_idx
  on public.market_source_health_events (discovery_run_id);

-- All market-index tables are server-only. No browser client receives direct table access.
alter table public.market_companies enable row level security;
alter table public.market_company_sources enable row level security;
alter table public.market_discovery_runs enable row level security;
alter table public.market_canonical_jobs enable row level security;
alter table public.market_job_source_observations enable row level security;
alter table public.market_source_health_events enable row level security;

revoke all on table public.market_companies from anon, authenticated;
revoke all on table public.market_company_sources from anon, authenticated;
revoke all on table public.market_discovery_runs from anon, authenticated;
revoke all on table public.market_canonical_jobs from anon, authenticated;
revoke all on table public.market_job_source_observations from anon, authenticated;
revoke all on table public.market_source_health_events from anon, authenticated;

grant all on table public.market_companies to service_role;
grant all on table public.market_company_sources to service_role;
grant all on table public.market_discovery_runs to service_role;
grant all on table public.market_canonical_jobs to service_role;
grant all on table public.market_job_source_observations to service_role;
grant all on table public.market_source_health_events to service_role;

create or replace function public.set_market_index_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_market_companies_updated_at on public.market_companies;
create trigger set_market_companies_updated_at
before update on public.market_companies
for each row execute function public.set_market_index_updated_at();

drop trigger if exists set_market_company_sources_updated_at on public.market_company_sources;
create trigger set_market_company_sources_updated_at
before update on public.market_company_sources
for each row execute function public.set_market_index_updated_at();

drop trigger if exists set_market_canonical_jobs_updated_at on public.market_canonical_jobs;
create trigger set_market_canonical_jobs_updated_at
before update on public.market_canonical_jobs
for each row execute function public.set_market_index_updated_at();

drop trigger if exists set_market_observations_updated_at on public.market_job_source_observations;
create trigger set_market_observations_updated_at
before update on public.market_job_source_observations
for each row execute function public.set_market_index_updated_at();

comment on table public.market_companies is
  'Canonical employer identities for the CogniTwist market index. Market data only; no candidate PII.';
comment on table public.market_company_sources is
  'Employer career sites and ATS/index sources to refresh independently of user searches.';
comment on table public.market_discovery_runs is
  'Run-level discovery telemetry used to measure source health and market coverage without claiming exhaustive coverage.';
comment on table public.market_canonical_jobs is
  'Deduplicated canonical vacancies assembled from one or more validated source observations.';
comment on table public.market_job_source_observations is
  'Provenance-preserving source observations linked to canonical vacancies.';
comment on table public.market_source_health_events is
  'Append-only health observations for discovery sources and market-ingestion runs.';
