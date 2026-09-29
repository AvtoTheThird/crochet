-- Provider subscription mirror (source of truth for recurring access state).
-- One row per Paddle subscription. Updated by the payment-webhook Edge Function
-- (service role) on subscription.* events. Never written by clients.

create table public.subscriptions (
	id uuid primary key default gen_random_uuid(),
	provider text not null default 'paddle',
	provider_subscription_id text not null,
	provider_customer_id text,
	user_id uuid references public.users (id) on delete set null,
	-- Mirrors Paddle subscription.status
	status text not null
		check (status in (
			'active',
			'trialing',
			'past_due',
			'paused',
			'canceled'
		)),
	-- Entitlement this subscription grants while active.
	product_tier text
		check (product_tier is null or product_tier in ('maker', 'lifetime')),
	-- Current recurring item (mirrored for admin visibility + debugging).
	price_id text,
	product_id text,
	currency text,
	-- Scheduled (non-terminal) change, e.g. a cancel/pause at period end.
	scheduled_change_action text
		check (scheduled_change_action is null or scheduled_change_action in ('cancel', 'pause', 'resume')),
	scheduled_change_at timestamptz,
	current_period_start timestamptz,
	current_period_end timestamptz,
	canceled_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	metadata jsonb not null default '{}'::jsonb,
	constraint subscriptions_provider_uidx unique (provider, provider_subscription_id)
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_provider_customer_idx
	on public.subscriptions (provider_customer_id)
	where provider_customer_id is not null;
