# PixelCount Studio

SvelteKit app for turning uploaded pixel art into tapestry / run-length stitch patterns.

## Setup

1. Copy `.env.example` → `.env`
2. Fill `PUBLIC_SUPABASE_ANON_KEY` from Supabase → **Project Settings → API**
3. Enable **Google** under Authentication → Providers
4. Add redirect URL: `http://localhost:5173/auth/callback`
5. (Done once) schema migration already applied; re-run with `npm run db:migrate` if needed

```sh
npm install
npm run dev
```

## Auth & routes

| URL | Who |
|-----|-----|
| `/` | Landing — Google login |
| `/auth/callback` | OAuth return |
| `/studio/load` … `/studio/walk` | Studio (logged-in only) |

## Supabase SQL layout

See `supabase/README.md` — migrations, schemas, RLS, storage bucket `project-images`.

## Security

Do not commit `.env`. If a database password was shared in chat, rotate it in the Supabase dashboard.
