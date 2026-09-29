-- Paddle subscription mirror + entitlement source for recurring plans.
-- Idempotent for scripts/apply-migration.mjs re-runs.

begin;

create table if not exists public.subscriptions (
	id uuid primary key default gen_random_uuid(),
	provider text not null default 'paddle',
	provider_subscription_id text not null,
	provider_customer_id text,
	user_id uuid references public.users (id) on delete set null,
	status text not null
		check (status in (
			'active',
			'trialing',
			'past_due',
			'paused',
			'canceled'
		)),
	product_tier text
		check (product_tier is null or product_tier in ('maker', 'lifetime')),
	price_id text,
	product_id text,
	currency text,
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

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_provider_customer_idx
	on public.subscriptions (provider_customer_id)
	where provider_customer_id is not null;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
	before update on public.subscriptions
	for each row execute function public.set_updated_at();

-- ========== RLS ==========
alter table public.subscriptions enable row level security;

-- Read own subscription; all writes via service role / Edge Functions.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
	on public.subscriptions for select
	to authenticated
	using (auth.uid() = user_id);

drop policy if exists "subscriptions_no_direct_insert" on public.subscriptions;
create policy "subscriptions_no_direct_insert"
	on public.subscriptions for insert
	to authenticated
	with check (false);

drop policy if exists "subscriptions_no_direct_update" on public.subscriptions;
create policy "subscriptions_no_direct_update"
	on public.subscriptions for update
	to authenticated
	using (false);

drop policy if exists "subscriptions_no_direct_delete" on public.subscriptions;
create policy "subscriptions_no_direct_delete"
	on public.subscriptions for delete
	to authenticated
	using (false);

commit;
