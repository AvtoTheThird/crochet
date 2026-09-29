# Edge Functions (affiliate + payments)

## Functions

| Function | JWT | Purpose |
|----------|-----|---------|
| `validate-referral-code` | off | Validate `?ref=` codes for cookie capture |
| `apply-referral` | on | Persist attribution (`cookie` or `manual`) for the signed-in user |
| `payment-webhook` | off | Paddle webhook: verifies signature, mirrors payments/subscriptions, applies entitlements + affiliate commissions |
| `cancel-subscription` | on | Signed-in user cancels their own subscription at period end via the Paddle API |

## Shared modules

- `_shared/processPayment.ts` — idempotent entitlement + commission ledger writer; subscription mirror + failed-payment recorder
- `_shared/paddle.ts` — `Paddle-Signature` HMAC verification, money conversion, event → row mapping
- `_shared/paddleIps.ts` — runtime Paddle source-IP allowlist (defense-in-depth on the webhook). Fetches `${env}/ips` (`data.ipv4_cidrs`) live, caches per instance, never hard-codes the list. Fails open if the list is unavailable (signature still enforced). Environment-aware: sandbox vs production endpoint.
- `_shared/access.ts` — single source of truth for paid-access rules
- `_shared/cors.ts`, `_shared/supabase.ts` — helpers

## Deploy

```bash
supabase functions deploy validate-referral-code
supabase functions deploy apply-referral
supabase functions deploy payment-webhook
supabase functions deploy cancel-subscription
```

## Secrets (Supabase → Edge Functions secrets)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically. Set the Paddle ones:

```bash
supabase secrets set \
  PADDLE_ENVIRONMENT=sandbox \
  PADDLE_WEBHOOK_SECRET=pdl_ntfset_...   # "secret key" from the notification destination \
  PADDLE_PRICE_TIER_MAP='{"pri_01m3cpajqaxf347q01c9c7wghq":"maker","pri_01m3cpajvyxdh3r8cgn03sak5k":"maker","pri_01m3cpak683g8b19kewyb995hg":"lifetime"}' \
  PADDLE_API_KEY=pdl_sdbx_apikey_...     # server API key — required by cancel-subscription only
```

- `PADDLE_ENVIRONMENT` — `sandbox` or `production`. Never defaulted; the functions return 500 if unset.
- `PADDLE_WEBHOOK_SECRET` — the destination secret from **Developer tools → Notifications** (sandbox destination for sandbox). Used by `payment-webhook`.
- `PADDLE_PRICE_TIER_MAP` — maps each Paddle price id to `maker` | `lifetime`. Used to resolve entitlement from an event; `custom_data.product_tier` is a fallback.
- `PADDLE_API_KEY` — server-side Paddle API key (**Developer tools → Authentication**). Required only by `cancel-subscription`. Sandbox keys are prefixed `pdl_sdbx_`, live keys `pdl_live_`. This key must NEVER appear in frontend / `PUBLIC_` code.

## Webhook event handling

| Event | Effect |
|-------|--------|
| `transaction.completed` | Upserts a `payments` row (`succeeded`), sets `users.subscription_tier`, writes an affiliate earn commission if the buyer is attributed |
| `transaction.payment_failed` | Records a `failed` payment; no entitlement, no commission (decline handling) |
| `subscription.created/activated/trialing/past_due` | Mirrors row + grants entitlement |
| `subscription.updated` | Mirrors new price/product + scheduled change; a scheduled cancel keeps `active` + access |
| `subscription.paused/canceled` | Mirrors terminal status + revokes entitlement (unless the user holds `lifetime`) |

## Cancellation flow

The profile page calls `cancel-subscription` (`supabase.functions.invoke`) with the user's JWT. It looks up the caller's active subscription in the `subscriptions` mirror, then calls Paddle `POST /subscriptions/{id}/cancel` with `effective_from: next_billing_period`. Paddle then fires `subscription.updated` (scheduled cancel → stays `active`, keeps access) and later `subscription.canceled` (revokes entitlement). No entitlement is changed by the function directly — the webhook is the single writer.

## Attribution lock

`user_referrals.locked_at` is set when the first `affiliate_commissions` earn row is inserted for that user. Manual codes may override cookie attribution only while unlocked.
