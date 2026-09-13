# Supabase

Structured SQL for PixelCount Studio.

```
supabase/
  migrations/     # Ordered migrations applied to the remote DB
  schemas/        # Source-of-truth table / enum / trigger definitions
  policies/       # Row Level Security
  storage/        # Buckets + storage policies
  seed/           # Optional seed data (empty for now)
```

## Apply migration

From the Supabase SQL editor, paste and run:

`migrations/20260313120000_initial_schema.sql`

Or with `psql`:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260313120000_initial_schema.sql
```

## Auth setup (Dashboard)

1. **Authentication → Providers → Google** — enable and add Client ID / Secret
2. **Authentication → URL configuration** — add redirect URLs:
   - `http://localhost:5173/auth/callback`
   - your production origin + `/auth/callback`
3. Copy **Project URL** and **anon public** key into `.env` (see `.env.example`)

## Notes

- `public.users` is created by trigger when `auth.users` gets a row (Google sign-in)
- `projects.image_url` stores a Storage path under bucket `project-images`: `{user_id}/{project_id}.png`
- `start_direction` is `left` | `right` (map from studio `ltr`/`rtl` in app code)
