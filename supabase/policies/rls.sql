-- Row Level Security (source of truth; also applied via migrations)

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.creators enable row level security;
alter table public.referral_codes enable row level security;
alter table public.user_referrals enable row level security;
alter table public.payments enable row level security;
alter table public.affiliate_commissions enable row level security;

-- users: read/update own row only (column grants further restrict entitlement fields)
create policy "users_select_own"
	on public.users for select
	using (auth.uid() = id);

create policy "users_update_own"
	on public.users for update
	using (auth.uid() = id)
	with check (auth.uid() = id);

-- inserts happen via trigger (security definer); block direct client inserts
create policy "users_no_direct_insert"
	on public.users for insert
	with check (false);

-- projects: full CRUD for owner
create policy "projects_select_own"
	on public.projects for select
	using (auth.uid() = user_id);

create policy "projects_insert_own"
	on public.projects for insert
	with check (auth.uid() = user_id);

create policy "projects_update_own"
	on public.projects for update
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

create policy "projects_delete_own"
	on public.projects for delete
	using (auth.uid() = user_id);

-- creators / referral_codes: no anon/authenticated policies → default deny
-- (manage via service role / dashboard; public lookup via RPC)

-- user_referrals: read own; writes only via security definer RPC / Edge Functions
create policy "user_referrals_select_own"
	on public.user_referrals for select
	to authenticated
	using (auth.uid() = user_id);

create policy "user_referrals_no_direct_insert"
	on public.user_referrals for insert
	to authenticated
	with check (false);

create policy "user_referrals_no_direct_update"
	on public.user_referrals for update
	to authenticated
	using (false);

create policy "user_referrals_no_direct_delete"
	on public.user_referrals for delete
	to authenticated
	using (false);

-- payments: read own; mutations via Edge Functions (service role)
create policy "payments_select_own"
	on public.payments for select
	to authenticated
	using (auth.uid() = user_id);

create policy "payments_no_direct_insert"
	on public.payments for insert
	to authenticated
	with check (false);

create policy "payments_no_direct_update"
	on public.payments for update
	to authenticated
	using (false);

create policy "payments_no_direct_delete"
	on public.payments for delete
	to authenticated
	using (false);

-- affiliate_commissions: no client access
create policy "affiliate_commissions_no_client_select"
	on public.affiliate_commissions for select
	to authenticated
	using (false);

create policy "affiliate_commissions_no_direct_insert"
	on public.affiliate_commissions for insert
	to authenticated
	with check (false);

create policy "affiliate_commissions_no_direct_update"
	on public.affiliate_commissions for update
	to authenticated
	using (false);

create policy "affiliate_commissions_no_direct_delete"
	on public.affiliate_commissions for delete
	to authenticated
	using (false);
