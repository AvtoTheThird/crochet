# Mari Admin

Local-only SvelteKit dashboard for affiliate creators, referral codes, payments, and commissions.

This folder is **gitignored** from the main `mari` repo — do not push it to GitHub.

## Setup

```bash
cd mari-admin
cp .env.example .env
```

Fill in `.env`:

| Variable | Where |
|----------|--------|
| `SUPABASE_URL` | Same project URL as the main app |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secret) |
| `ADMIN_PASSWORD` | Password for this dashboard login |
| `ADMIN_SESSION_SECRET` | Long random string for session cookie HMAC |

```bash
npm install
npm run dev
```

Open **http://localhost:5174** (port chosen so it does not clash with the main app on 5173).

## Pages

- **Overview** — counts + recent payments/commissions
- **Creators** — create / edit / delete, commission % cut
- **Referral codes** — create / edit / activate / delete
- **Attributions** — monitor `user_referrals`; unlock / reassign (admin)
- **Payments** — filter/search + detail (user, referral, commissions)
- **Commissions** — ledger + status updates (`pending` → `available` → `paid`, etc.)

## Security notes

- Service role key is server-only (never `PUBLIC_*`).
- Auth is a shared operator password — fine for local ops, not for public internet without hardening.
- Uses the same Supabase DB as the main app; does not modify the main app codebase.
