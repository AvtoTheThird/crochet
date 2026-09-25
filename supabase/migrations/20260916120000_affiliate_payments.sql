-- Affiliate creators, referral attribution, payments, commission ledger
-- Idempotent where practical for scripts/apply-migration.mjs re-runs.

begin;

-- ========== creators ==========
create table if not exists public.creators (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	channel_url text,
	commission_percentage_cut numeric(5, 2) not null
		check (commission_percentage_cut >= 0 and commission_percentage_cut <= 100),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists creators_name_idx on public.creators (lower(name));

drop trigger if exists creators_set_updated_at on public.creators;
create trigger creators_set_updated_at
	before update on public.creators
	for each row execute function public.set_updated_at();

-- ========== referral_codes ==========
-- Codes are normalized here (not duplicated on creators).
create table if not exists public.referral_codes (
	id uuid primary key default gen_random_uuid(),
	creator_id uuid not null references public.creators (id) on delete cascade,
	code text not null,
	active boolean not null default true,
	created_at timestamptz not null default now(),
	constraint referral_codes_code_nonempty check (length(trim(code)) > 0)
);

create unique index if not exists referral_codes_code_lower_uidx
	on public.referral_codes (lower(code));
create index if not exists referral_codes_creator_id_idx
	on public.referral_codes (creator_id);
create index if not exists referral_codes_active_idx
	on public.referral_codes (active)
	where active = true;

-- ========== user_referrals ==========
create table if not exists public.user_referrals (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete cascade,
	creator_id uuid not null references public.creators (id) on delete restrict,
	referral_code_id uuid not null references public.referral_codes (id) on delete restrict,
	source text not null
		check (source in ('cookie', 'manual')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	locked_at timestamptz,
	constraint user_referrals_user_id_key unique (user_id)
);

create index if not exists user_referrals_creator_id_idx
	on public.user_referrals (creator_id);
create index if not exists user_referrals_referral_code_id_idx
	on public.user_referrals (referral_code_id);
create index if not exists user_referrals_locked_at_idx
	on public.user_referrals (locked_at)
	where locked_at is not null;

drop trigger if exists user_referrals_set_updated_at on public.user_referrals;
create trigger user_referrals_set_updated_at
	before update on public.user_referrals
	for each row execute function public.set_updated_at();

-- ========== payments ==========
create table if not exists public.payments (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete restrict,
	provider text not null,
	provider_payment_id text not null,
	provider_order_id text,
	subscription_id text,
	product_tier text
		check (product_tier is null or product_tier in ('maker', 'lifetime')),
	amount numeric(12, 2) not null check (amount >= 0),
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
	processed_at timestamptz,
	paid_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	metadata jsonb not null default '{}'::jsonb,
	constraint payments_provider_payment_uidx unique (provider, provider_payment_id)
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_subscription_id_idx
	on public.payments (subscription_id)
	where subscription_id is not null;
create index if not exists payments_processed_at_idx
	on public.payments (processed_at)
	where processed_at is not null;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
	before update on public.payments
	for each row execute function public.set_updated_at();

-- ========== affiliate_commissions ==========
create table if not exists public.affiliate_commissions (
	id uuid primary key default gen_random_uuid(),
	creator_id uuid not null references public.creators (id) on delete restrict,
	user_id uuid not null references public.users (id) on delete restrict,
	payment_id uuid not null references public.payments (id) on delete restrict,
	payment_provider text not null,
	provider_payment_id text not null,
	subscription_id text,
	amount numeric(12, 2) not null check (amount >= 0),
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

create unique index if not exists affiliate_commissions_earn_payment_uidx
	on public.affiliate_commissions (payment_provider, provider_payment_id)
	where entry_kind = 'earn';

create unique index if not exists affiliate_commissions_earn_payment_id_uidx
	on public.affiliate_commissions (payment_id)
	where entry_kind = 'earn';

create index if not exists affiliate_commissions_creator_id_idx
	on public.affiliate_commissions (creator_id);
create index if not exists affiliate_commissions_user_id_idx
	on public.affiliate_commissions (user_id);
create index if not exists affiliate_commissions_status_idx
	on public.affiliate_commissions (status);
create index if not exists affiliate_commissions_available_at_idx
	on public.affiliate_commissions (available_at);

-- ========== analytics view ==========
create or replace view public.creator_referral_stats
with (security_invoker = true)
as
select
	c.id as creator_id,
	c.name,
	c.commission_percentage_cut,
	count(ur.id)::integer as users_referred,
	count(ur.id) filter (where ur.locked_at is not null)::integer as users_referred_locked
from public.creators c
left join public.user_referrals ur on ur.creator_id = c.id
group by c.id, c.name, c.commission_percentage_cut;

-- ========== helper functions ==========
create or replace function public.normalize_referral_code(p_code text)
returns text
language sql
immutable
as $$
	select nullif(lower(trim(p_code)), '');
$$;

create or replace function public.lookup_active_referral_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	normalized text := public.normalize_referral_code(p_code);
	rec record;
begin
	if normalized is null then
		return jsonb_build_object('valid', false, 'reason', 'empty');
	end if;

	select
		rc.id as referral_code_id,
		rc.code,
		rc.creator_id,
		c.name as creator_name
	into rec
	from public.referral_codes rc
	join public.creators c on c.id = rc.creator_id
	where lower(rc.code) = normalized
	  and rc.active = true
	limit 1;

	if not found then
		return jsonb_build_object('valid', false, 'reason', 'not_found');
	end if;

	return jsonb_build_object(
		'valid', true,
		'referral_code_id', rec.referral_code_id,
		'code', rec.code,
		'creator_id', rec.creator_id,
		'creator_name', rec.creator_name
	);
end;
$$;

revoke all on function public.lookup_active_referral_code(text) from public;
grant execute on function public.lookup_active_referral_code(text) to anon, authenticated;

create or replace function public.apply_referral_attribution(p_code text, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	uid uuid := auth.uid();
	normalized text := public.normalize_referral_code(p_code);
	src text := lower(trim(p_source));
	rc record;
	existing public.user_referrals%rowtype;
	bypass boolean := coalesce(current_setting('app.bypass_referral_lock', true), '') = 'true';
begin
	if uid is null then
		raise exception 'not_authenticated' using errcode = '42501';
	end if;

	if src is null or src not in ('cookie', 'manual') then
		raise exception 'invalid_source' using errcode = '22023';
	end if;

	if normalized is null then
		raise exception 'invalid_code' using errcode = '22023';
	end if;

	select
		rc0.id,
		rc0.creator_id,
		rc0.code
	into rc
	from public.referral_codes rc0
	where lower(rc0.code) = normalized
	  and rc0.active = true
	limit 1;

	if not found then
		return jsonb_build_object('ok', false, 'reason', 'invalid_code');
	end if;

	select * into existing
	from public.user_referrals ur
	where ur.user_id = uid;

	if found then
		if existing.locked_at is not null and not bypass then
			return jsonb_build_object(
				'ok', false,
				'reason', 'locked',
				'locked_at', existing.locked_at,
				'creator_id', existing.creator_id,
				'referral_code_id', existing.referral_code_id
			);
		end if;

		if src = 'cookie' then
			return jsonb_build_object(
				'ok', true,
				'unchanged', true,
				'reason', 'already_attributed',
				'creator_id', existing.creator_id,
				'referral_code_id', existing.referral_code_id,
				'source', existing.source
			);
		end if;

		update public.user_referrals
		set
			creator_id = rc.creator_id,
			referral_code_id = rc.id,
			source = src,
			updated_at = now()
		where user_id = uid;

		return jsonb_build_object(
			'ok', true,
			'updated', true,
			'creator_id', rc.creator_id,
			'referral_code_id', rc.id,
			'code', rc.code,
			'source', src
		);
	end if;

	insert into public.user_referrals (
		user_id,
		creator_id,
		referral_code_id,
		source
	) values (
		uid,
		rc.creator_id,
		rc.id,
		src
	);

	return jsonb_build_object(
		'ok', true,
		'created', true,
		'creator_id', rc.creator_id,
		'referral_code_id', rc.id,
		'code', rc.code,
		'source', src
	);
end;
$$;

revoke all on function public.apply_referral_attribution(text, text) from public;
grant execute on function public.apply_referral_attribution(text, text) to authenticated;

create or replace function public.enforce_user_referral_lock()
returns trigger
language plpgsql
as $$
declare
	bypass boolean := coalesce(current_setting('app.bypass_referral_lock', true), '') = 'true';
begin
	if tg_op = 'UPDATE'
		and old.locked_at is not null
		and not bypass
		and (
			new.creator_id is distinct from old.creator_id
			or new.referral_code_id is distinct from old.referral_code_id
			or new.source is distinct from old.source
			or (new.locked_at is distinct from old.locked_at and new.locked_at is null)
		)
	then
		raise exception 'referral attribution is locked'
			using errcode = 'P0001';
	end if;
	return new;
end;
$$;

drop trigger if exists user_referrals_enforce_lock on public.user_referrals;
create trigger user_referrals_enforce_lock
	before update on public.user_referrals
	for each row execute function public.enforce_user_referral_lock();

create or replace function public.lock_referral_on_commission_earn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.entry_kind = 'earn' then
		update public.user_referrals
		set locked_at = coalesce(locked_at, now()),
			updated_at = now()
		where user_id = new.user_id
		  and locked_at is null;
	end if;
	return new;
end;
$$;

drop trigger if exists affiliate_commissions_lock_referral on public.affiliate_commissions;
create trigger affiliate_commissions_lock_referral
	after insert on public.affiliate_commissions
	for each row execute function public.lock_referral_on_commission_earn();

-- ========== harden users entitlement columns ==========
-- Clients may update profile fields but not paid-tier fields.
revoke update on table public.users from anon, authenticated;
grant update (
	first_name,
	last_name,
	username,
	email,
	auth_provider,
	auth_provider_token,
	free_project_used,
	promo_code_used,
	updated_at
) on table public.users to authenticated;

-- ========== RLS ==========
alter table public.creators enable row level security;
alter table public.referral_codes enable row level security;
alter table public.user_referrals enable row level security;
alter table public.payments enable row level security;
alter table public.affiliate_commissions enable row level security;

-- creators / referral_codes: no direct client writes; no broad reads
-- (lookups go through security definer RPC / Edge Functions)
drop policy if exists "creators_no_client_all" on public.creators;
-- Explicit deny via absence of policies for anon/authenticated (default deny)

drop policy if exists "referral_codes_no_select" on public.referral_codes;

-- user_referrals: users can read own attribution only; writes via RPC (security definer)
drop policy if exists "user_referrals_select_own" on public.user_referrals;
create policy "user_referrals_select_own"
	on public.user_referrals for select
	to authenticated
	using (auth.uid() = user_id);

drop policy if exists "user_referrals_no_direct_insert" on public.user_referrals;
create policy "user_referrals_no_direct_insert"
	on public.user_referrals for insert
	to authenticated
	with check (false);

drop policy if exists "user_referrals_no_direct_update" on public.user_referrals;
create policy "user_referrals_no_direct_update"
	on public.user_referrals for update
	to authenticated
	using (false);

drop policy if exists "user_referrals_no_direct_delete" on public.user_referrals;
create policy "user_referrals_no_direct_delete"
	on public.user_referrals for delete
	to authenticated
	using (false);

-- payments: read own only; all mutations via service role / Edge Functions
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
	on public.payments for select
	to authenticated
	using (auth.uid() = user_id);

drop policy if exists "payments_no_direct_insert" on public.payments;
create policy "payments_no_direct_insert"
	on public.payments for insert
	to authenticated
	with check (false);

drop policy if exists "payments_no_direct_update" on public.payments;
create policy "payments_no_direct_update"
	on public.payments for update
	to authenticated
	using (false);

drop policy if exists "payments_no_direct_delete" on public.payments;
create policy "payments_no_direct_delete"
	on public.payments for delete
	to authenticated
	using (false);

-- commissions: no client access (creators will get a dashboard later)
drop policy if exists "affiliate_commissions_no_client_select" on public.affiliate_commissions;
create policy "affiliate_commissions_no_client_select"
	on public.affiliate_commissions for select
	to authenticated
	using (false);

drop policy if exists "affiliate_commissions_no_direct_insert" on public.affiliate_commissions;
create policy "affiliate_commissions_no_direct_insert"
	on public.affiliate_commissions for insert
	to authenticated
	with check (false);

drop policy if exists "affiliate_commissions_no_direct_update" on public.affiliate_commissions;
create policy "affiliate_commissions_no_direct_update"
	on public.affiliate_commissions for update
	to authenticated
	using (false);

drop policy if exists "affiliate_commissions_no_direct_delete" on public.affiliate_commissions;
create policy "affiliate_commissions_no_direct_delete"
	on public.affiliate_commissions for delete
	to authenticated
	using (false);

commit;
