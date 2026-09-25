-- Referral codes belonging to creators (one creator → many codes)

create table public.referral_codes (
	id uuid primary key default gen_random_uuid(),
	creator_id uuid not null references public.creators (id) on delete cascade,
	code text not null,
	active boolean not null default true,
	created_at timestamptz not null default now(),
	constraint referral_codes_code_nonempty check (length(trim(code)) > 0)
);

-- Case-insensitive uniqueness
create unique index referral_codes_code_lower_uidx on public.referral_codes (lower(code));
create index referral_codes_creator_id_idx on public.referral_codes (creator_id);
create index referral_codes_active_idx on public.referral_codes (active) where active = true;
