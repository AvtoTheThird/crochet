-- Affiliate commission ledger (immutable earn history; refunds use reversal rows / status)

create table public.affiliate_commissions (
	id uuid primary key default gen_random_uuid(),
	creator_id uuid not null references public.creators (id) on delete restrict,
	user_id uuid not null references public.users (id) on delete restrict,
	payment_id uuid not null references public.payments (id) on delete restrict,
	payment_provider text not null,
	provider_payment_id text not null,
	subscription_id text,
	-- Snapshot of eligible revenue used for this commission
	amount numeric(12, 2) not null check (amount >= 0),
	-- Snapshot of creator cut at payment time (do not re-read creator later)
	commission_percentage numeric(5, 2) not null
		check (commission_percentage >= 0 and commission_percentage <= 100),
	commission numeric(12, 2) not null,
	currency text not null,
	entry_kind text not null default 'earn'
		check (entry_kind in ('earn', 'reversal')),
	status text not null default 'pending'
		check (status in ('pending', 'available', 'paid', 'reversed', 'void')),
	reverses_commission_id uuid references public.affiliate_commissions (id) on delete restrict,
	created_at timestamptz not null default now(),
	available_at timestamptz,
	paid_at timestamptz,
	constraint affiliate_commissions_reversal_requires_target check (
		(entry_kind = 'earn' and reverses_commission_id is null)
		or (entry_kind = 'reversal' and reverses_commission_id is not null)
	)
);

-- One earn commission per provider payment (idempotent webhooks)
create unique index affiliate_commissions_earn_payment_uidx
	on public.affiliate_commissions (payment_provider, provider_payment_id)
	where entry_kind = 'earn';

create unique index affiliate_commissions_earn_payment_id_uidx
	on public.affiliate_commissions (payment_id)
	where entry_kind = 'earn';

create index affiliate_commissions_creator_id_idx on public.affiliate_commissions (creator_id);
create index affiliate_commissions_user_id_idx on public.affiliate_commissions (user_id);
create index affiliate_commissions_status_idx on public.affiliate_commissions (status);
create index affiliate_commissions_available_at_idx on public.affiliate_commissions (available_at);
