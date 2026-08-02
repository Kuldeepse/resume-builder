# Supabase production setup for Career Network

Use this checklist when production registration or the admin dashboard reports that private Supabase storage is not configured.

## 1. Run the database migrations

Run these in your Supabase SQL editor:

- `supabase/migrations/20260802_career_network_registrations.sql`
- `supabase/migrations/20260802_whatsapp_group_consent.sql`

After running them, confirm the `career_network_registrations` table exists and includes the WhatsApp consent columns.

## 2. Add server-side environment variables in Vercel

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Also required for the current production flow:

- `NEXT_PUBLIC_DATA_CONTROLLER_NAME`
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`
- `CAREER_NETWORK_ADMIN_PASSWORD`

Never expose the service-role key through a `NEXT_PUBLIC_` variable.

## 3. Supabase key compatibility

The app now supports both common server-side Supabase key formats:

- Legacy JWT-style `service_role` keys:
  The app sends both `apikey` and `Authorization: Bearer`.
- Newer `sb_secret_...` keys:
  The app sends `apikey` only.

That means you can keep using the legacy key immediately, or use a newer secret key without changing the route code.

## 4. Redeploy after saving environment variables

Vercel environment variable changes only apply to new deployments. After saving or changing any variable above, redeploy the latest production deployment using the latest environment values.

## 5. Expected behaviour after a healthy deployment

- `/career-network` should submit successfully and return `pending_verification`
- `/admin/career-network/login` should load
- `/admin/career-network` should show private registrations after admin login

## 6. Error guide

- `Private registration storage is not configured`
  One or both Supabase env vars are missing from the deployed environment.
- `Registration could not be stored securely`
  The env vars exist, but the URL, key, migration, or permissions are wrong.
- `Could not load registrations from private storage`
  The admin dashboard can reach Supabase, but the credentials, table, or permissions still need attention.
