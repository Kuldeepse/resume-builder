alter table public.career_network_registrations
add column if not exists status_lookup_code text;

update public.career_network_registrations
set status_lookup_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where status_lookup_code is null;

alter table public.career_network_registrations
alter column status_lookup_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

alter table public.career_network_registrations
alter column status_lookup_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'career_network_status_lookup_code_uq'
  ) then
    alter table public.career_network_registrations
    add constraint career_network_status_lookup_code_uq unique (status_lookup_code);
  end if;
end;
$$;

comment on column public.career_network_registrations.status_lookup_code is
  'Private tracking code shared with the registrant for status lookup. Never expose through a public directory.';
