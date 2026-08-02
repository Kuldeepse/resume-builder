-- Add optional WhatsApp group consent fields for manual invite approval.
-- Run this only if the base career_network_registrations table already exists.

alter table public.career_network_registrations
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_group_consent boolean not null default false,
  add column if not exists whatsapp_group_status text not null default 'not_requested';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'career_network_registration_whatsapp_group_status_ck'
  ) then
    alter table public.career_network_registrations
      add constraint career_network_registration_whatsapp_group_status_ck
      check (whatsapp_group_status in ('not_requested', 'pending_approval', 'approved', 'invited', 'declined', 'withdrawn'));
  end if;
end $$;
