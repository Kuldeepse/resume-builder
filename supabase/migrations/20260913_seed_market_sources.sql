-- CogniTwist Job Market Index: bootstrap the employer/ATS sources already used by Job Scout.
-- This turns today's hard-coded source knowledge into durable source-registry data without changing search behaviour yet.

insert into public.market_companies (identity_key, canonical_name, normalized_name, status, last_seen_at, metadata)
values
  ('company:d8ed3d349ff8bc2acf39744a723a97d1', 'Rightmove', 'rightmove', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:5ca12fdf1628d9938b94ef52eb3dd4d8', 'Bondsmith', 'bondsmith', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:e9f902a932f0817566e15cd5c43f83e9', 'Capital on Tap', 'capital on tap', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:ea354ef27aab00dab51811bdace8e194', 'Modulr', 'modulr', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:5e9268a98c8af567f1c8ac53be8cd62f', 'Blacklane', 'blacklane', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:0bb9de1b4e0c41adbc1076a1e5fc8974', 'Speechmatics', 'speechmatics', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:bd9930ed0e8bf2fdafc806db282a7ecf', 'Capco', 'capco', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:59f6a92a268c51b3f536dfc33fb67cde', 'Yondr', 'yondr', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:13bfaf8f3c4750362fa8a7e9682ec630', 'Partly', 'partly', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:a24e63c5bef69d676ddf46c3f918c107', 'Orbital', 'orbital', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:456cb302a30d01b12d3c033a9ef24dbf', 'Heron Data', 'heron data', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:9a78aa4b2d4a6716700d8b8a0579dd76', 'Freetrade', 'freetrade', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:8198cf44658ba5777e75bb65e09281cf', 'Elliptic', 'elliptic', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:8c15a763882d486210de3f51de73ac15', 'Ema', 'ema', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:da47c2f450a4f9d538d86d600d55149a', 'Swap', 'swap', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:13d6da4a64e3ae1a9520f2cdc8c503c6', 'Antithesis', 'antithesis', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:3031c86f2d71ef01b77ad3d5681f6d35', 'Lyra Health', 'lyra health', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:e6b8a8bc4f7ba7af526acfe8956228ec', 'OpenPayd', 'openpayd', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:6e77701251f02cc58ac349a31bc5dfe2', 'Serverfarm', 'serverfarm', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb),
  ('company:a7c0e2de6457cf2213910a478af6f88a', 'Equinix', 'equinix', 'active', now(), '{"bootstrap":"configured_job_scout"}'::jsonb)
on conflict (identity_key) do update set
  canonical_name = excluded.canonical_name,
  normalized_name = excluded.normalized_name,
  status = excluded.status,
  last_seen_at = greatest(public.market_companies.last_seen_at, excluded.last_seen_at),
  metadata = public.market_companies.metadata || excluded.metadata;

insert into public.market_company_sources (
  company_id, source_key, source_type, source_name, source_url, source_host,
  external_source_key, coverage_scope, refresh_interval_minutes, status, metadata
)
select c.id, v.source_key, v.source_type, v.source_name, v.source_url, v.source_host,
       v.external_source_key, 'public_jobs', 360, 'active', v.metadata
from (
  values
    ('company:d8ed3d349ff8bc2acf39744a723a97d1', 'ats:greenhouse:rightmovecareers', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/rightmovecareers/jobs?content=true', 'boards-api.greenhouse.io', 'rightmovecareers', '{"provider":"greenhouse"}'::jsonb),
    ('company:5ca12fdf1628d9938b94ef52eb3dd4d8', 'ats:greenhouse:bondsmith', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/bondsmith/jobs?content=true', 'boards-api.greenhouse.io', 'bondsmith', '{"provider":"greenhouse"}'::jsonb),
    ('company:e9f902a932f0817566e15cd5c43f83e9', 'ats:greenhouse:capitalontap', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/capitalontap/jobs?content=true', 'boards-api.greenhouse.io', 'capitalontap', '{"provider":"greenhouse"}'::jsonb),
    ('company:ea354ef27aab00dab51811bdace8e194', 'ats:greenhouse:modulrfinance', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/modulrfinance/jobs?content=true', 'boards-api.greenhouse.io', 'modulrfinance', '{"provider":"greenhouse"}'::jsonb),
    ('company:5e9268a98c8af567f1c8ac53be8cd62f', 'ats:greenhouse:blacklane', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/blacklane/jobs?content=true', 'boards-api.greenhouse.io', 'blacklane', '{"provider":"greenhouse"}'::jsonb),
    ('company:0bb9de1b4e0c41adbc1076a1e5fc8974', 'ats:greenhouse:speechmatics', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/speechmatics/jobs?content=true', 'boards-api.greenhouse.io', 'speechmatics', '{"provider":"greenhouse"}'::jsonb),
    ('company:bd9930ed0e8bf2fdafc806db282a7ecf', 'ats:greenhouse:capco', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/capco/jobs?content=true', 'boards-api.greenhouse.io', 'capco', '{"provider":"greenhouse"}'::jsonb),
    ('company:59f6a92a268c51b3f536dfc33fb67cde', 'ats:greenhouse:yondrgroup', 'ats', 'Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/yondrgroup/jobs?content=true', 'boards-api.greenhouse.io', 'yondrgroup', '{"provider":"greenhouse"}'::jsonb),
    ('company:13bfaf8f3c4750362fa8a7e9682ec630', 'ats:ashby:partly.com', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/partly.com?includeCompensation=true', 'api.ashbyhq.com', 'partly.com', '{"provider":"ashby"}'::jsonb),
    ('company:a24e63c5bef69d676ddf46c3f918c107', 'ats:ashby:orbital', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/orbital?includeCompensation=true', 'api.ashbyhq.com', 'orbital', '{"provider":"ashby"}'::jsonb),
    ('company:456cb302a30d01b12d3c033a9ef24dbf', 'ats:ashby:herondata', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/herondata?includeCompensation=true', 'api.ashbyhq.com', 'herondata', '{"provider":"ashby"}'::jsonb),
    ('company:9a78aa4b2d4a6716700d8b8a0579dd76', 'ats:ashby:freetrade', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/freetrade?includeCompensation=true', 'api.ashbyhq.com', 'freetrade', '{"provider":"ashby"}'::jsonb),
    ('company:8198cf44658ba5777e75bb65e09281cf', 'ats:ashby:Elliptic', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/Elliptic?includeCompensation=true', 'api.ashbyhq.com', 'Elliptic', '{"provider":"ashby"}'::jsonb),
    ('company:8c15a763882d486210de3f51de73ac15', 'ats:ashby:ema', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/ema?includeCompensation=true', 'api.ashbyhq.com', 'ema', '{"provider":"ashby"}'::jsonb),
    ('company:da47c2f450a4f9d538d86d600d55149a', 'ats:ashby:swap', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/swap?includeCompensation=true', 'api.ashbyhq.com', 'swap', '{"provider":"ashby"}'::jsonb),
    ('company:13d6da4a64e3ae1a9520f2cdc8c503c6', 'ats:ashby:antithesis', 'ats', 'Ashby', 'https://api.ashbyhq.com/posting-api/job-board/antithesis?includeCompensation=true', 'api.ashbyhq.com', 'antithesis', '{"provider":"ashby"}'::jsonb),
    ('company:3031c86f2d71ef01b77ad3d5681f6d35', 'ats:lever:lyrahealth', 'ats', 'Lever', 'https://api.lever.co/v0/postings/lyrahealth?mode=json', 'api.lever.co', 'lyrahealth', '{"provider":"lever"}'::jsonb),
    ('company:e6b8a8bc4f7ba7af526acfe8956228ec', 'ats:lever:OpenPayd', 'ats', 'Lever', 'https://api.lever.co/v0/postings/OpenPayd?mode=json', 'api.lever.co', 'OpenPayd', '{"provider":"lever"}'::jsonb),
    ('company:6e77701251f02cc58ac349a31bc5dfe2', 'ats:lever:serverfarm', 'ats', 'Lever', 'https://api.lever.co/v0/postings/serverfarm?mode=json', 'api.lever.co', 'serverfarm', '{"provider":"lever"}'::jsonb),
    ('company:a7c0e2de6457cf2213910a478af6f88a', 'employer:equinix:uk-operations', 'employer_career', 'Equinix careers', 'https://careers.equinix.com/operations-UK', 'careers.equinix.com', 'operations-UK', '{"provider":"custom_employer"}'::jsonb)
) as v(company_identity_key, source_key, source_type, source_name, source_url, source_host, external_source_key, metadata)
join public.market_companies c on c.identity_key = v.company_identity_key
on conflict (source_key) do update set
  company_id = excluded.company_id,
  source_type = excluded.source_type,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  source_host = excluded.source_host,
  external_source_key = excluded.external_source_key,
  status = 'active',
  metadata = public.market_company_sources.metadata || excluded.metadata;
