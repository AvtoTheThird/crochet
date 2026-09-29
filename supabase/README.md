# Supabase

Structured SQL for Qsovio.

```
supabase/
  migrations/     # Ordered migrations applied to the remote DB
  schemas/        # Source-of-truth table / enum / trigger definitions
  policies/       # Row Level Security
  storage/        # Buckets + storage policies
  functions/      # Edge Functions (referrals + payment webhook seam)
  seed/           # Optional seed data
```

## Apply migration

From the Supabase SQL editor, paste and run the latest file under `migrations/`.

Or with `psql` / the helper script:

```bash
node --env-file=.env scripts/apply-migration.mjs
```

## Auth setup (Dashboard)

1. **Authentication → Providers → Google** — enable and add Client ID / Secret
2. **Authentication → URL configuration** — add redirect URLs:
   - `http://localhost:5173/auth/callback`
   - your production origin + `/auth/callback`
3. Copy **Project URL** and **anon public** key into `.env` (see `.env.example`)

## Affiliate / payments

- Migration `20260916120000_affiliate_payments.sql` adds creators, referral codes, user referrals, payments, and commission ledger.
- Referral codes live only on `referral_codes` (normalized; creators do not store a duplicate `code` column).
- Attribution lock: `user_referrals.locked_at` is set when the first earn commission is written.
- Paid entitlements must be applied by the `payment-webhook` Edge Function via `processSuccessfulPayment` — not from the browser.
- See `functions/README.md`.

## Notes

- `public.users` is created by trigger when `auth.users` gets a row
- `projects.image_url` stores a Storage path under bucket `project-images`: `{user_id}/{project_id}.png`
- `start_direction` is `left` | `right` (map from studio `ltr`/`rtl` in app code)
- `users.subscription_tier` is not client-writable (column grants); service role / webhook only
