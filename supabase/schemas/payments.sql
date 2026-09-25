-- Provider-agnostic payment records (source of truth for paid access + idempotency)

create table public.payments (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete restrict,
	provider text not null,
	provider_payment_id text not null,
	provider_order_id text,
	subscription_id text,
	-- Intended entitlement product (maker | lifetime); applied on successful webhook processing
	product_tier text
		check (product_tier is null or product_tier in ('maker', 'lifetime')),
	-- Amount charged by the provider (gross). Commission base may differ later.
	amount numeric(12, 2) not null check (amount >= 0),
	-- Eligible revenue used for affiliate commission when processed (defaults to amount).
	eligible_amount numeric(12, 2) check (eligible_amount is null or eligible_amount >= 0),
	currency text not null,
	status text not null default 'pending'
		check (status in (
			'created',
			'pending',
			'succeeded',
			'failed',
			'refunded',
			'partially_refunded',
			'chargeback',
			'cancelled'
		)),
	-- Set when entitlement (+ commission) processing completed successfully.
	processed_at timestamptz,
	paid_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	metadata jsonb not null default '{}'::jsonb,
	constraint payments_provider_payment_uidx unique (provider, provider_payment_id)
);

create index payments_user_id_idx on public.payments (user_id);
create index payments_status_idx on public.payments (status);
create index payments_subscription_id_idx on public.payments (subscription_id)
	where subscription_id is not null;
create index payments_processed_at_idx on public.payments (processed_at)
	where processed_at is not null;
