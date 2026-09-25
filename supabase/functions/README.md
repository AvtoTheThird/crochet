# Edge Functions (affiliate + payments)

## Functions

| Function | JWT | Purpose |
|----------|-----|---------|
| `validate-referral-code` | off | Validate `?ref=` codes for cookie capture |
| `apply-referral` | on | Persist attribution (`cookie` or `manual`) for the signed-in user |
| `payment-webhook` | off | Provider callbacks; Flitt verification left as a seam |

## Shared modules

- `_shared/processPayment.ts` — idempotent entitlement + commission ledger writer
- `_shared/cors.ts`, `_shared/supabase.ts` — helpers

## Deploy

```bash
supabase functions deploy validate-referral-code
supabase functions deploy apply-referral
supabase functions deploy payment-webhook
```

Set secrets: `SUPABASE_SERVICE_ROLE_KEY` (usually auto), and later Flitt merchant secrets.

## Attribution lock

`user_referrals.locked_at` is set when the first `affiliate_commissions` earn row is inserted for that user. Manual codes may override cookie attribution only while unlocked.
