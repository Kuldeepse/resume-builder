-- RoleCraft Career Network: private registration table
-- Run this migration in the Supabase project before enabling registration.

create extension if not exists pgcrypto;

create table if not exists public.career_network_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  role text not null check (role in ('candidate', 'referrer', 'mentor')),
  linkedin_profile text,
  whatsapp_number text,
  whatsapp_group_consent boolean not null default false,
  whatsapp_group_status text not null default 'not_requested'
    check (whatsapp_group_status in ('not_requested', 'pending_approval', 'approved', 'invited', 'declined', 'withdrawn')),
  current_company text,
  professional_area text not null,
  privacy_notice_version text not null,
  terms_accepted boolean not null default false,
  age_confirmed boolean not null default false,
  marketing_opt_in boolean not null default false,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'declined', 'deleted')),
  retention_until date not null default (current_date + interval '12 months')::date,
  constraint career_network_registration_email_role_uq unique (email, role)
);

alter table public.career_network_registrations enable row level security;

-- No public read, insert, update, or delete policies are intentionally created.
-- The server-side API uses the Supabase service role. Never expose that key to the browser.
revoke all on table public.career_network_registrations from anon, authenticated;
grant all on table public.career_network_registrations to service_role;

create or replace function public.set_career_network_updated_at()
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

drop trigger if exists set_career_network_updated_at on public.career_network_registrations;
create trigger set_career_network_updated_at
before update on public.career_network_registrations
for each row execute function public.set_career_network_updated_at();

comment on table public.career_network_registrations is
  'Private RoleCraft Career Network registrations. Never expose via public directory or anon API.';
