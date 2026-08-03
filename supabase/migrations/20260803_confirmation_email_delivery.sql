alter table public.career_network_registrations
add column if not exists confirmation_email_status text not null default 'pending'
  check (confirmation_email_status in ('pending', 'sent', 'failed', 'skipped'));

alter table public.career_network_registrations
add column if not exists confirmation_email_sent_at timestamptz;

alter table public.career_network_registrations
add column if not exists confirmation_email_error text;

comment on column public.career_network_registrations.confirmation_email_status is
  'Private admin-only delivery status for the registrant confirmation email.';

comment on column public.career_network_registrations.confirmation_email_sent_at is
  'Timestamp when the registrant confirmation email was successfully sent.';

comment on column public.career_network_registrations.confirmation_email_error is
  'Last delivery failure or skip reason for the registrant confirmation email.';
