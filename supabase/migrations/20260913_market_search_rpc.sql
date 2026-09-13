-- CogniTwist Job Market Index: server-only search surface.
-- Postgres is the initial search engine; OpenSearch can replace/augment this projection once the corpus is large enough.

create index if not exists market_canonical_jobs_search_gin_idx
on public.market_canonical_jobs using gin (
  to_tsvector(
    'simple',
    coalesce(employer_canonical, '') || ' ' ||
    coalesce(title_canonical, '') || ' ' ||
    coalesce(location_canonical, '') || ' ' ||
    coalesce(description_excerpt, '')
  )
);

create or replace function public.search_market_jobs(
  p_query text,
  p_location text default null,
  p_freshness_days integer default 14,
  p_limit integer default 100
)
returns table (
  id uuid,
  title text,
  company text,
  location text,
  salary text,
  posted timestamptz,
  description text,
  link text,
  remote boolean,
  source text,
  source_type text,
  direct boolean,
  last_validated_at timestamptz,
  source_count integer,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      nullif(trim(coalesce(p_query, '')), '') as query_text,
      nullif(lower(trim(coalesce(p_location, ''))), '') as location_text,
      case
        when coalesce(p_freshness_days, 14) <= 0 then 30
        else greatest(1, least(90, p_freshness_days))
      end as freshness_days,
      greatest(1, least(200, coalesce(p_limit, 100))) as result_limit
  ), scored as (
    select
      j.*,
      case
        when params.query_text is null then 0.0::real
        else ts_rank_cd(
          to_tsvector(
            'simple',
            coalesce(j.employer_canonical, '') || ' ' ||
            coalesce(j.title_canonical, '') || ' ' ||
            coalesce(j.location_canonical, '') || ' ' ||
            coalesce(j.description_excerpt, '')
          ),
          websearch_to_tsquery('simple', params.query_text)
        )
      end as search_rank,
      params.*
    from public.market_canonical_jobs j
    cross join params
    where j.status = 'active'
      and j.last_validated_at >= now() - make_interval(days => params.freshness_days)
      and (
        params.query_text is null
        or to_tsvector(
          'simple',
          coalesce(j.employer_canonical, '') || ' ' ||
          coalesce(j.title_canonical, '') || ' ' ||
          coalesce(j.location_canonical, '') || ' ' ||
          coalesce(j.description_excerpt, '')
        ) @@ websearch_to_tsquery('simple', params.query_text)
      )
      and (
        params.location_text is null
        or params.location_text in ('uk', 'united kingdom')
        or lower(j.location_canonical) like '%' || params.location_text || '%'
        or (params.location_text = 'remote' and j.remote)
      )
  )
  select
    scored.id,
    scored.title_canonical as title,
    scored.employer_canonical as company,
    scored.location_canonical as location,
    coalesce(scored.salary_raw, 'Not disclosed') as salary,
    scored.source_posted_at as posted,
    coalesce(scored.description_excerpt, '') as description,
    scored.canonical_url as link,
    scored.remote,
    coalesce(scored.latest_source_name, 'CogniTwist Market Index') as source,
    coalesce(scored.latest_source_type, 'market_index') as source_type,
    coalesce(scored.latest_source_type, '') in ('direct_employer', 'ats', 'employer_career') as direct,
    scored.last_validated_at,
    scored.source_count,
    scored.search_rank as rank
  from scored
  order by
    scored.search_rank desc,
    scored.source_count desc,
    scored.last_validated_at desc
  limit (select result_limit from params);
$$;

revoke all on function public.search_market_jobs(text, text, integer, integer) from public;
revoke all on function public.search_market_jobs(text, text, integer, integer) from anon, authenticated;
grant execute on function public.search_market_jobs(text, text, integer, integer) to service_role;

comment on function public.search_market_jobs(text, text, integer, integer) is
  'Server-only initial search projection over recently validated canonical market jobs. Candidate/profile data is not used here.';
