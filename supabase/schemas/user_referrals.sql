-- Permanent referral attribution: which creator/code brought a user.
-- One row per user. Cookie is only a transport until this row is written.
--
-- Lock rule: locked_at is set when the first affiliate_commissions earn entry
-- is created for this user. Until then, manual attribution may override cookie.
-- After lock, only an explicit admin bypass may change attribution.

create table public.user_referrals (
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

create index user_referrals_creator_id_idx on public.user_referrals (creator_id);
create index user_referrals_referral_code_id_idx on public.user_referrals (referral_code_id);
create index user_referrals_locked_at_idx on public.user_referrals (locked_at)
	where locked_at is not null;
